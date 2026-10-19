// Next + Chromium, with explicit read-only API fixtures. No production or DB access.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const base = 'http://localhost:3105';
const output = new URL('../.test-build/back-navigation/', import.meta.url);
await mkdir(output, { recursive: true });
const id = (n) => n.toString(16).padStart(24, '0');
const eventId = id(1),
  matchId = id(2);
const teams = [0, 1].map((n) => ({
  id: id(10 + n),
  name: `Time ${n + 1}`,
  type: 'TEAM',
  members: [0, 1].map((i) => ({
    id: id(20 + n * 2 + i),
    name: `Jogador ${n * 2 + i + 1}`,
    participantType: 'USER',
    allocated: true,
  })),
}));
const event = {
  id: eventId,
  name: 'Pelada de navegação',
  date: '2026-10-18',
  startTime: '20:00',
  endTime: '21:00',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 4,
  waitingCount: 0,
  playersPerTeam: 2,
  formationExists: true,
  ownPresence: 'CONFIRMED',
  ownAllocated: true,
  ownParticipantId: id(20),
};
const match = {
  id: matchId,
  eventId,
  revision: 0,
  status: 'IN_PROGRESS',
  durationMinutes: 3,
  startedAt: new Date().toISOString(),
  teamA: { ...teams[0], players: teams[0].members },
  teamB: { ...teams[1], players: teams[1].members },
  goals: [],
  score: { teamA: 0, teamB: 0 },
};
const listing = '/org/events?q=pelada&status=ACTIVE&page=0&slide=0&scroll=45';
const withReturn = (path, from) =>
  `${path}?returnTo=${encodeURIComponent(from)}`;
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--port',
    '3105',
    '--hostname',
    '127.0.0.1',
  ],
  {
    cwd: process.cwd(),
    windowsHide: true,
    env: { ...process.env, API_URL: 'http://127.0.0.1:9' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let browser,
  startup = '';
for (const stream of [server.stdout, server.stderr])
  stream.on('data', (data) => {
    startup = (startup + data).slice(-5000);
  });
try {
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null) throw new Error(startup);
        try {
          return (await fetch(`${base}/events`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    for (const role of ['PLAYER', 'ADMIN', 'ORGANIZER']) {
      const context = await browser.newContext({
        viewport,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage(),
        calls = [],
        errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(`${base}/api/**`, (route) => {
        const path = new URL(route.request().url()).pathname;
        calls.push(path);
        assert.equal(
          route.request().method(),
          'GET',
          'Return/refresh navigation must not perform mutations',
        );
        let body;
        if (path === '/api/auth/me')
          body = {
            user: {
              id: id(99),
              firstName: 'Navigation',
              lastName: 'Fixture',
              email: 'navigation@example.invalid',
              role,
            },
          };
        else if (path === '/api/auth/csrf')
          body = { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` };
        else if (path === '/api/account/preferences')
          body = { googleLinked: false, localCredentials: true };
        else if (path === '/api/account/members')
          body = { items: [], nextCursor: null };
        else if (path === '/api/events')
          body = { items: [event], nextCursor: null };
        else if (path === `/api/events/${eventId}`)
          body = { event, teams, waitingParticipants: [] };
        else if (path === `/api/events/${eventId}/matches`)
          body = { matches: [match] };
        else if (path === `/api/events/${eventId}/matches/${matchId}`)
          body = match;
        else if (path === '/api/statistics')
          body = {
            period: { from: '2026-10-01', to: '2026-10-31' },
            finishedMatchCount: 0,
            scorers: [],
            assistants: [],
          };
        else throw new Error(`Unexpected request ${path}`);
        return route.fulfill({ json: body });
      });
      const main = page.getByRole('main');
      async function header(destination, refresh = true) {
        const back = main.getByRole('link', { name: 'Voltar', exact: true });
        await expect(back).toHaveCount(1);
        await expect(back).toHaveAttribute('href', destination);
        await expect(back).toHaveText('');
        await expect(back.locator('svg')).toHaveCount(1);
        const heading = main.getByRole('heading', { level: 1 });
        const backBox = await back.boundingBox(),
          titleBox = await heading.boundingBox();
        assert.ok(backBox.width >= 44 && backBox.height >= 44);
        assert.ok(backBox.x + backBox.width <= titleBox.x + 1);
        const update = main.getByRole('button', { name: /^Atualizar/ });
        if (refresh) {
          await expect(update).toBeEnabled();
          const updateBox = await update.boundingBox();
          assert.ok(titleBox.x + titleBox.width <= updateBox.x + 1);
          assert.ok(
            Math.abs(
              backBox.y +
                backBox.height / 2 -
                updateBox.y -
                updateBox.height / 2,
            ) < 1,
          );
          const count = calls.length;
          await update.click();
          await expect.poll(() => calls.length).toBeGreaterThan(count);
          await expect(update).toBeEnabled();
          await expect(back).toHaveAttribute('href', destination);
        } else await expect(update).toHaveCount(0);
        await page.keyboard.press('Tab');
        await back.focus();
        await expect(back).toHaveCSS('outline-style', 'solid');
        const sizes = await page.evaluate(() => {
          const node = document.getElementById('events-main');
          return {
            viewport: innerWidth,
            scroll: document.documentElement.scrollWidth,
            body: document.body.scrollHeight,
            height: innerHeight,
            main: node.clientWidth,
            content: node.scrollWidth,
          };
        });
        assert.ok(
          sizes.scroll <= sizes.viewport &&
            sizes.body <= sizes.height &&
            sizes.content <= sizes.main,
          JSON.stringify(sizes),
        );
        return back;
      }
      try {
        await page.goto(`${base}/events`, { waitUntil: 'domcontentloaded' });
        await expect(
          main.getByRole('heading', { name: event.name, exact: true }),
        ).toBeVisible();
        await expect(
          main.getByRole('link', { name: 'Voltar', exact: true }),
        ).toHaveCount(0);
        const title = await main
          .getByRole('heading', { level: 1 })
          .boundingBox();
        const update = await main
          .getByRole('button', { name: 'Atualizar', exact: true })
          .boundingBox();
        assert.ok(title.x + title.width <= update.x + 1);
        await page.goto(`${base}/stats`, { waitUntil: 'domcontentloaded' });
        await expect(
          main.getByRole('tab', { name: 'Artilharia' }),
        ).toBeVisible();
        await expect(
          main.getByRole('link', { name: 'Voltar', exact: true }),
        ).toHaveCount(0);
        await page.goto(`${base}/org`, { waitUntil: 'domcontentloaded' });
        await expect(
          page.getByRole('navigation', { name: 'Acessos de gerenciamento' }),
        ).toBeVisible();
        await expect(
          main.getByRole('link', { name: 'Voltar', exact: true }),
        ).toHaveCount(0);
        await page.goto(`${base}/org/preferences`, {
          waitUntil: 'domcontentloaded',
        });
        await header('/org', false);
        await page.goto(`${base}/org/members`, {
          waitUntil: 'domcontentloaded',
        });
        await header('/org', false);
        if (role === 'PLAYER') {
          const origin = '/events?q=pelada&page=0&slide=0&scroll=45';
          await page.goto(
            `${base}${withReturn(`/events/${eventId}`, origin)}`,
            { waitUntil: 'domcontentloaded' },
          );
          await header(origin);
          await main
            .getByRole('link', { name: 'Voltar', exact: true })
            .press('Enter');
          await expect(page).toHaveURL(base + origin);
          await page.goto(`${base}/events/${eventId}`, {
            waitUntil: 'domcontentloaded',
          });
          await header('/events');
        } else {
          await page.goto(`${base}/org/events`, {
            waitUntil: 'domcontentloaded',
          });
          await header('/org');
          await expect(
            main.getByRole('link', { name: 'Súmulas', exact: true }),
          ).toHaveCount(0);
          await page.goto(`${base}/org/events/${eventId}/teams`, {
            waitUntil: 'domcontentloaded',
          });
          await header(
            role === 'ORGANIZER' ? `/org/events/${eventId}` : '/org/events',
          );
          await page.screenshot({
            path: fileURLToPath(
              new URL(`${role}-${viewport.width}-teams.png`, output),
            ),
          });
          const origin =
            role === 'ORGANIZER'
              ? withReturn(`/org/events/${eventId}`, listing)
              : listing;
          const teamsPath = withReturn(`/org/events/${eventId}/teams`, origin);
          await page.goto(
            `${base}${withReturn(`/org/events/${eventId}/teams/edit`, origin)}`,
            { waitUntil: 'domcontentloaded' },
          );
          await header(teamsPath);
          await expect(
            main.getByRole('button', { name: 'Confirmar troca', exact: true }),
          ).toBeVisible();
          await main
            .getByRole('link', { name: 'Voltar', exact: true })
            .press('Enter');
          await expect(page).toHaveURL(base + teamsPath);
          await header(origin);
          await main.getByRole('link', { name: 'Voltar', exact: true }).click();
          await expect(page).toHaveURL(base + origin);
          if (role === 'ORGANIZER') {
            await header(listing);
            await main
              .getByRole('link', { name: 'Voltar', exact: true })
              .click();
          }
          await expect(page).toHaveURL(base + listing);
          await expect(main.locator('input[name="search"]')).toHaveValue(
            'pelada',
          );
          await page.goto(
            `${base}/org/events/${eventId}/teams?returnTo=https%3A%2F%2Fevil.invalid`,
            { waitUntil: 'domcontentloaded' },
          );
          await header(
            role === 'ORGANIZER' ? `/org/events/${eventId}` : '/org/events',
          );
          for (const [path, back] of [
            ['/org/matches', '/org'],
            [`/org/matches/${eventId}`, '/org/matches'],
            [`/org/matches/${eventId}/${matchId}`, `/org/matches/${eventId}`],
          ]) {
            await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            await header(back);
            await main
              .getByRole('link', { name: 'Voltar', exact: true })
              .press('Enter');
            await expect(page).toHaveURL(base + back);
          }
        }
        await page.goto(`${base}/forgot-password`, {
          waitUntil: 'domcontentloaded',
        });
        await expect(
          page.getByRole('link', { name: 'Voltar ao login', exact: true }),
        ).toHaveAttribute('href', '/');
        await expect(
          page.getByRole('link', { name: 'Voltar', exact: true }),
        ).toHaveCount(0);
        assert.deepEqual(errors, []);
        console.log(
          `PASS back navigation ${role} ${viewport.width}x${viewport.height}: direct routes, nested context, fallbacks, title layout, keyboard, refresh and auth exception (API fixtures)`,
        );
      } catch (error) {
        await page.screenshot({
          path: fileURLToPath(
            new URL(`failure-${role}-${viewport.width}.png`, output),
          ),
        });
        console.error(await page.locator('body').innerText());
        throw error;
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
