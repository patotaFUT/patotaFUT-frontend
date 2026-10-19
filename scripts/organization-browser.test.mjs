// Real Chromium + Next routes. API/session fixtures are intercepted; no real account or DB writes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const base = 'http://localhost:3104';
const output = new URL('../.test-build/organization-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const eventId = '507f1f77bcf86cd799439011';
const event = {
  id: eventId,
  name: 'Evento de navegação',
  date: '2026-10-18',
  startTime: '20:00',
  endTime: '22:00',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 4,
  waitingCount: 0,
  playersPerTeam: 2,
  formationExists: true,
  ownPresence: null,
  ownAllocated: false,
  ownParticipantId: null,
};
const capture = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, output)) });
async function checkLayout(page) {
  const box = await page.evaluate(() => {
    const main = document.getElementById('events-main');
    return {
      width: innerWidth,
      height: innerHeight,
      docWidth: document.documentElement.scrollWidth,
      bodyHeight: document.body.scrollHeight,
      mainWidth: main?.clientWidth,
      mainScrollWidth: main?.scrollWidth,
    };
  });
  assert.ok(
    box.docWidth <= box.width && box.bodyHeight <= box.height,
    JSON.stringify(box),
  );
  assert.ok(box.mainScrollWidth <= box.mainWidth, JSON.stringify(box));
}
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--port',
    '3104',
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
let startup = '',
  browser;
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
          return (await fetch(`${base}/org`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  const alias = await fetch(`${base}/ORG?source=bookmark`, {
    redirect: 'manual',
  });
  assert.equal(alias.status, 308);
  assert.equal(new URL(alias.headers.get('location'), base).pathname, '/org');
  assert.equal(
    new URL(alias.headers.get('location'), base).search,
    '?source=bookmark',
  );
  assert.equal(
    (await fetch(`${base}/org`, { redirect: 'manual' })).status,
    200,
  );
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
  ]) {
    for (const role of ['PLAYER', 'ADMIN', 'ORGANIZER']) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 1000,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [],
        calls = [];
      let authenticated = true,
        failSession = false,
        sessionGate;
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(`${base}/api/**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        calls.push({ path, method: route.request().method() });
        if (path === '/api/auth/me') {
          if (sessionGate) await sessionGate;
          return route.fulfill({
            status: failSession ? 503 : authenticated ? 200 : 401,
            json:
              failSession || !authenticated
                ? { error: 'Fixture de sessão' }
                : {
                    user: {
                      id: '507f1f77bcf86cd799439099',
                      firstName: 'Perfil',
                      lastName: 'Teste',
                      email: 'org@example.invalid',
                      role,
                    },
                  },
          });
        }
        if (path === '/api/auth/csrf')
          return route.fulfill({
            json: { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` },
          });
        if (path === '/api/auth/logout') {
          authenticated = false;
          return route.fulfill({ status: 204 });
        }
        if (path === '/api/auth/refresh')
          return route.fulfill({
            status: 401,
            json: { error: 'Fixture sem sessão' },
          });
        if (path === '/api/account/preferences')
          return route.fulfill({
            json: { googleLinked: false, localCredentials: true },
          });
        if (path === '/api/account/members')
          return route.fulfill({ json: { items: [], nextCursor: null } });
        if (path === '/api/events')
          return route.fulfill({ json: { items: [event], nextCursor: null } });
        if (path === `/api/events/${eventId}`)
          return route.fulfill({
            json: { event, teams: [], waitingParticipants: [] },
          });
        if (path === `/api/events/${eventId}/matches`)
          return route.fulfill({ json: { matches: [] } });
        if (path === '/api/statistics')
          return route.fulfill({
            json: {
              period: { from: '2026-10-01', to: '2026-10-31' },
              finishedMatchCount: 0,
              scorers: [],
              assistants: [],
            },
          });
        throw new Error(
          `Unexpected API request: ${route.request().method()} ${path}`,
        );
      });
      try {
        await page.goto(`${base}/ORG`, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(`${base}/org`);
        const main = page.getByRole('main'),
          menu = page.getByRole('navigation', { name: 'Menu principal' });
        const hub = page.getByRole('navigation', {
          name: 'Acessos de gerenciamento',
        });
        await expect(hub).toBeVisible();
        const heading = main.getByRole('heading', {
          name: 'Gerenciamento',
          exact: true,
        });
        const titleLayout = await heading.evaluate((node) => ({
          height: node.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight),
        }));
        assert.ok(
          titleLayout.height <= titleLayout.lineHeight + 1,
          'Management title must fit on one line at supported viewports',
        );
        const labels = await hub.getByRole('link').allTextContents();
        assert.deepEqual(
          labels.map((name) => name.trim()),
          role === 'ORGANIZER'
            ? ['Eventos', 'Súmulas', 'Integrantes', 'Preferências']
            : role === 'ADMIN'
              ? ['Eventos', 'Súmulas', 'Preferências']
              : ['Preferências'],
        );
        assert.ok(
          calls.every((call) => call.path.startsWith('/api/auth/')),
          'Central must not fetch administrative data',
        );
        const gridBox = await hub.getByRole('list').boundingBox(),
          mainBox = await main.boundingBox();
        assert.ok(
          Math.abs(
            gridBox.x + gridBox.width / 2 - mainBox.x - mainBox.width / 2,
          ) < 1,
        );
        for (const card of await hub.locator('a, button').all()) {
          await expect(card).toHaveCSS('color', 'rgb(255, 255, 255)');
          await expect(card.locator('svg')).toBeVisible();
          assert.notEqual(
            await card.evaluate(
              (node) => getComputedStyle(node).backgroundImage,
            ),
            'none',
          );
        }
        const first = hub.getByRole('link').first();
        await first.focus();
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        await expect(focused).toHaveCSS('outline-style', 'solid');
        await expect(focused).toHaveCSS('outline-width', '2px');
        // Keyboard opens preferences and returns to the canonical central.
        await hub
          .getByRole('link', { name: 'Preferências', exact: true })
          .focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(`${base}/org/preferences`);
        await expect(
          main.getByRole('heading', { name: 'Dados pessoais' }),
        ).toBeVisible();
        await expect(
          main.getByRole('textbox', { name: 'Nome', exact: true }),
        ).toBeVisible();
        await checkLayout(page);
        await main.getByRole('link', { name: 'Voltar', exact: true }).click();
        await expect(hub).toBeVisible();
        if (role === 'ORGANIZER') {
          await hub
            .getByRole('link', { name: 'Integrantes', exact: true })
            .click();
          await expect(page).toHaveURL(`${base}/org/members`);
          await expect(
            main.getByRole('heading', { name: 'Integrantes', exact: true }),
          ).toBeVisible();
          await capture(
            page,
            `${role}-${viewport.width}x${viewport.height}-members.png`,
          );
          await main.getByRole('link', { name: 'Voltar', exact: true }).click();
        } else {
          await page.goto(`${base}/org/members`, {
            waitUntil: 'domcontentloaded',
          });
          await expect(
            main.getByText('Você não tem permissão para acessar esta área.'),
          ).toBeVisible();
          await expect(main.getByText('Em breve', { exact: true })).toHaveCount(
            0,
          );
          await main.getByRole('link', { name: 'Voltar', exact: true }).click();
        }
        if (role !== 'PLAYER') {
          await expect(
            menu.getByRole('link', { name: 'Gerenciar' }),
          ).toHaveAttribute('href', '/org');
          await expect(
            menu.getByRole('link', { name: 'Gerenciar' }),
          ).toHaveAttribute('aria-current', 'page');
          await hub.getByRole('link', { name: 'Eventos', exact: true }).click();
          await expect(page).toHaveURL(`${base}/org/events`);
          await expect(
            main.getByRole('link', { name: 'Súmulas', exact: true }),
          ).toHaveCount(0);
          await expect(
            main.getByRole('button', { name: 'Criar evento', exact: true }),
          ).toHaveCount(role === 'ORGANIZER' ? 1 : 0);
          await menu
            .getByRole('link', { name: 'Gerenciar', exact: true })
            .click();
          await expect(hub).toBeVisible();
          await hub.getByRole('link', { name: 'Súmulas', exact: true }).click();
          await expect(page).toHaveURL(`${base}/org/matches`);
          await expect(
            main.getByRole('heading', { name: event.name, exact: true }),
          ).toBeVisible();
          await expect(
            main.getByRole('link', { name: 'Voltar', exact: true }),
          ).toHaveAttribute('href', '/org');
          await main
            .getByRole('button', { name: 'Criar súmula', exact: true })
            .click();
          const createDialog = page.getByRole('dialog', {
            name: 'Criar súmula',
            exact: true,
          });
          await expect(createDialog).toBeVisible();
          await createDialog
            .getByRole('button', { name: 'Fechar', exact: true })
            .click();
          await expect(createDialog).toHaveCount(0);
          await page.goto(`${base}/org/matches/${eventId}`, {
            waitUntil: 'domcontentloaded',
          });
          await expect(
            main.getByRole('link', { name: 'Voltar', exact: true }),
          ).toHaveAttribute('href', '/org/matches');
          await main.getByRole('link', { name: 'Voltar', exact: true }).click();
          await main.getByRole('link', { name: 'Voltar', exact: true }).click();
          await expect(hub).toBeVisible();
        } else {
          await expect(
            menu.getByRole('link', { name: 'Gerenciar' }),
          ).toHaveCount(1);
          for (const path of ['/org/events', '/org/matches']) {
            await page.goto(base + path, { waitUntil: 'domcontentloaded' });
            await expect(main.getByText(/permissão/i)).toBeVisible();
          }
          await page.goto(`${base}/org`, { waitUntil: 'domcontentloaded' });
          await expect(hub).toBeVisible();
        }
        await checkLayout(page);
        await capture(
          page,
          `${role}-${viewport.width}x${viewport.height}-central.png`,
        );
        if (role === 'ORGANIZER') {
          const bounds = await hub.getByRole('link').evaluateAll((nodes) =>
            nodes.map((node) => {
              const box = node.getBoundingClientRect();
              return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              };
            }),
          );
          assert.ok(
            Math.abs(bounds[0].y - bounds[1].y) < 1 &&
              Math.abs(bounds[2].y - bounds[3].y) < 1,
          );
          const logout = await hub
            .getByRole('button', { name: 'Sair da Conta' })
            .boundingBox();
          assert.ok(
            Math.abs(
              logout.x + logout.width / 2 - gridBox.x - gridBox.width / 2,
            ) < 1,
          );
          await hub
            .getByRole('button', { name: 'Sair da Conta' })
            .scrollIntoViewIfNeeded();
          await expect(
            hub.getByRole('button', { name: 'Sair da Conta' }),
          ).toBeInViewport();
        }
        await menu
          .getByRole('link', { name: 'Estatísticas', exact: true })
          .click();
        await expect(
          page.getByRole('heading', { name: 'Estatísticas dos Jogadores' }),
        ).toBeVisible();
        await expect(
          main.getByRole('tab', { name: 'Artilharia' }),
        ).toBeVisible();
        await expect(
          main.getByRole('tab', { name: 'Assistentes' }),
        ).toBeVisible();
        await expect(main.getByText('Em breve', { exact: true })).toHaveCount(
          0,
        );
        await page.goto(`${base}/org`, { waitUntil: 'domcontentloaded' });
        await expect(hub).toBeVisible();
        assert.equal(calls.filter((call) => call.method !== 'GET').length, 0);
        await hub.getByRole('button', { name: 'Sair da Conta' }).click();
        await expect(page).toHaveURL(`${base}/`);
        assert.equal(
          calls.filter((call) => call.path === '/api/auth/logout').length,
          1,
        );
        assert.ok(
          calls
            .filter((call) => call.path.startsWith('/api/account/'))
            .every((call) => call.method === 'GET'),
        );
        if (role !== 'ORGANIZER')
          assert.ok(
            !calls.some((call) => call.path.startsWith('/api/account/members')),
          );
        // Existing access loading/error/retry, without rendering cards before authentication.
        authenticated = true;
        failSession = true;
        await page.goto(`${base}/org`, { waitUntil: 'domcontentloaded' });
        await expect(
          page.getByRole('dialog', { name: 'Falha ao preparar o acesso' }),
        ).toBeVisible();
        await expect(hub).toHaveCount(0);
        failSession = false;
        await page.getByRole('button', { name: 'Tentar novamente' }).click();
        await expect(hub).toBeVisible();
        let release;
        sessionGate = new Promise((resolve) => {
          release = resolve;
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(
          page.getByRole('dialog', { name: 'carregando', exact: true }),
        ).toBeVisible();
        await expect(hub).toHaveCount(0);
        release();
        sessionGate = undefined;
        await expect(hub).toBeVisible();
        assert.deepEqual(errors, []);
        console.log(
          `PASS organization ${role} ${viewport.width}x${viewport.height}: routes/permissions/keyboard/links/placeholders/logout/loading/layout (API fixtures)`,
        );
      } catch (error) {
        await capture(
          page,
          `failure-${role}-${viewport.width}x${viewport.height}.png`,
        );
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
