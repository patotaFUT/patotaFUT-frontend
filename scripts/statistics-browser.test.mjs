// Real Chromium -> Next proxy -> Express -> guarded local replica set.
// Only explicitly marked delay/failure cases intercept statistics HTTP requests.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import express from '../../patotaFUT-API/node_modules/express/index.js';
import mongoose from '../../patotaFUT-API/node_modules/mongoose/index.js';
import { liveFixture } from '../../patotaFUT-API/scripts/helpers/matches-live-fixture.mjs';
import { MatchService } from '../../patotaFUT-API/dist/services/match.service.js';
import { statisticsPeriod } from '../../patotaFUT-API/dist/services/statistics-period.js';
import { issueAccessToken } from '../../patotaFUT-API/dist/security/tokens.js';
import { createAuthRoutes } from '../../patotaFUT-API/dist/routes/auth.routes.js';
import { createEventRoutes } from '../../patotaFUT-API/dist/routes/event.routes.js';
import { createStatisticsRoutes } from '../../patotaFUT-API/dist/routes/statistics.routes.js';
import { AuthError } from '../../patotaFUT-API/dist/services/auth.service.js';
import { EventError } from '../../patotaFUT-API/dist/services/event-error.js';

const base = 'http://localhost:3103';
const output = new URL('../.test-build/statistics-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const secrets = {
  access: 'statistics-test-access-'.repeat(4),
  refresh: 'statistics-test-refresh-'.repeat(4),
};
const config = {
  secrets,
  csrfSecret: 'statistics-test-csrf-'.repeat(4),
  secure: false,
  sameSite: 'lax',
  origins: [base],
  googleClientId: undefined,
};
let browser, next, api;
const display = (day) =>
  `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const snapshot = (page, name) =>
  page.screenshot({ path: fileURLToPath(new URL(name, output)) });
async function noOverflow(page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    height: innerHeight,
    main: document.getElementById('events-main')?.getBoundingClientRect().right,
  }));
  assert.ok(sizes.scroll <= sizes.viewport, JSON.stringify(sizes));
  assert.ok(sizes.bodyHeight <= sizes.height, JSON.stringify(sizes));
  assert.ok(sizes.main <= sizes.viewport, JSON.stringify(sizes));
}
async function choosePeriod(page, from, to) {
  await page.getByRole('button', { name: 'Selecionar período' }).click();
  const dialog = page.getByRole('dialog', { name: 'Selecionar período' });
  await expect(dialog).toBeVisible();
  const start = dialog.getByLabel('Data inicial (DD/MM/AAAA)');
  await expect(start).toHaveAttribute('inputmode', 'numeric');
  await start.fill(from.replaceAll('/', ''));
  await expect(start).toHaveValue(from);
  await dialog.getByLabel('Data final (DD/MM/AAAA)').fill(to);
  await dialog.getByRole('button', { name: 'Aplicar período' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Selecionar período' }),
  ).toBeFocused();
  await expect(
    page.getByText('Carregando estatísticas...', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(`Período: ${from} até ${to}`)).toBeVisible();
}
async function createFixture() {
  const f = await liveFixture();
  const suffix = `Stats${randomUUID().slice(0, 8)}`;
  for (const [index, user] of f.users.entries()) {
    user.firstName = [
      'Ana',
      'Bia',
      'Caio',
      'NomeMuitoLongoSemEspacosParaConferirAQuebraDeLinha',
    ][index];
    user.lastName = suffix;
    await user.save();
  }
  const now = new Date();
  const period = statisticsPeriod({}, now);
  const previous = new Date(period.start);
  previous.setUTCDate(0);
  const previousDay = previous.toISOString().slice(0, 10);
  // Controlled SERVER clock makes exact temporal ties deterministic. Persistence is real.
  const matches = new MatchService(undefined, () => new Date(now));
  async function event(date, kind) {
    let detail = await f.events.create(f.organizer.id, {
      name: `${suffix} ${kind}`,
      date,
      startTime: '23:58',
      endTime: '23:59',
    });
    for (const user of f.users)
      detail = await f.events.presence(user.id, detail.event.id, {
        revision: detail.event.revision,
        status: 'CONFIRMED',
      });
    detail = await f.events.form(f.organizer.id, detail.event.id, {
      revision: detail.event.revision,
      playersPerTeam: 2,
    });
    let match = await matches.create(
      f.admin.id,
      detail.event.id,
      f.input(detail),
    );
    match = await matches.start(f.otherAdmin.id, detail.event.id, match.id, {
      revision: match.revision,
    });
    if (kind === 'highlights' || kind === 'previous') {
      const team = match.teamA;
      for (const [scorer, assistant] of [
        [0, 1],
        [1, 0],
      ]) {
        match = await matches.recordGoal(
          f.admin.id,
          detail.event.id,
          match.id,
          {
            revision: match.revision,
            teamId: team.id,
            scorerParticipantId: team.players[scorer].id,
            assistParticipantId: team.players[assistant].id,
            minute: 0,
          },
        );
      }
    } else {
      match = await matches.recordGoal(f.admin.id, detail.event.id, match.id, {
        revision: match.revision,
        teamId: match.teamB.id,
        ownGoal: true,
        minute: 0,
      });
    }
    if (kind !== 'running')
      await matches.finish(f.otherAdmin.id, detail.event.id, match.id, {
        revision: match.revision,
        confirmed: true,
      });
    detail = await f.events.detail(f.organizer.id, detail.event.id);
    if (kind === 'empty')
      detail = await f.events.status(f.organizer.id, detail.event.id, {
        revision: detail.event.revision,
        status: 'CANCELED',
      });
    return { detail, mid: match.id };
  }
  return {
    ...f,
    suffix,
    period,
    previousDay,
    active: await event(period.from, 'highlights'),
    empty: await event(period.from, 'empty'),
    previous: await event(previousDay, 'previous'),
    running: await event(period.from, 'running'),
  };
}

try {
  // Connect only through the existing guard, before serving any API.
  await liveFixture();
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/auth', createAuthRoutes(config));
  app.use('/events', createEventRoutes(config));
  app.use('/statistics', createStatisticsRoutes(config));
  app.use((error, _req, res, _next) => {
    const expected = error instanceof AuthError || error instanceof EventError;
    if (!expected) console.error(error);
    res.status(expected ? error.status : 500).json({
      error: expected ? error.message : 'Falha no teste.',
      code: error.code,
    });
  });
  api = app.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const address = api.address();
  assert.ok(address && typeof address !== 'string');
  next = spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      'start',
      '--port',
      '3103',
      '--hostname',
      '127.0.0.1',
    ],
    {
      cwd: process.cwd(),
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        API_URL: `http://127.0.0.1:${address.port}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let startup = '';
  for (const stream of [next.stdout, next.stderr])
    stream.on('data', (chunk) => {
      startup = (startup + chunk).slice(-6000);
    });
  await expect
    .poll(
      async () => {
        if (next.exitCode !== null) throw new Error(startup);
        try {
          return (await fetch(`${base}/api/auth/me`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(401);
  assert.equal((await fetch(`${base}/api/statistics`)).status, 401);
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    const f = await createFixture();
    for (const user of [f.player, f.admin, f.organizer]) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 1000,
        reducedMotion: 'reduce',
        timezoneId:
          viewport.width === 768 ? 'Pacific/Kiritimati' : 'America/Sao_Paulo',
      });
      try {
        await context.addCookies([
          {
            name: 'patotafut_access',
            value: issueAccessToken(
              user.id,
              secrets,
              new Date(),
              user.authVersion ?? 0,
            ),
            url: base,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}/events`, { waitUntil: 'domcontentloaded' });
        await page
          .getByRole('link', { name: 'Estatísticas', exact: true })
          .click();
        await expect(page).toHaveURL(`${base}/stats`);
        await expect(
          page.getByRole('heading', { name: 'Estatísticas dos Jogadores' }),
        ).toBeVisible();
        const full = await (
          await context.request.get(`${base}/api/statistics`)
        ).json();
        assert.equal(full.period.from, f.period.from);
        assert.equal(full.period.to, f.period.to);
        await expect(
          page.getByText(
            `Período: ${display(f.period.from)} até ${display(f.period.to)}`,
          ),
        ).toBeVisible();
        const scorersTab = page.getByRole('tab', { name: 'Artilharia' });
        const assistantsTab = page.getByRole('tab', {
          name: 'Assistentes',
          exact: true,
        });
        await scorersTab.focus();
        await page.keyboard.press('ArrowRight');
        await expect(assistantsTab).toBeFocused();
        await expect(assistantsTab).toHaveAttribute('aria-selected', 'true');
        await expect(
          page.getByRole('list', { name: 'Ranking de assistentes' }),
        ).toBeVisible();
        await page.keyboard.press('Home');
        await expect(scorersTab).toBeFocused();
        await expect(page.locator('li[data-podium="1"]').first()).toBeVisible();
        const podium = await page
          .locator('li[data-podium]')
          .evaluateAll((items) =>
            items.map((item) => ({
              position: item.getAttribute('data-podium'),
              color: getComputedStyle(item).borderTopColor,
            })),
          );
        const colors = {
          1: 'rgb(234, 179, 8)',
          2: 'rgb(169, 173, 176)',
          3: 'rgb(196, 119, 54)',
        };
        assert.ok(podium.length > 0);
        for (const row of podium) assert.equal(row.color, colors[row.position]);
        await page.getByRole('button', { name: 'Buscar jogador' }).click();
        const search = page.getByRole('searchbox', {
          name: 'Buscar por nome ou sobrenome',
        });
        await expect(search).toBeFocused();
        await search.fill(f.suffix);
        await expect(
          page
            .getByRole('list', { name: 'Ranking de artilharia' })
            .locator('li'),
        ).toHaveCount(4);
        for (const row of full.scorers.filter((r) => r.lastName === f.suffix)) {
          const item = page
            .getByRole('listitem')
            .filter({ hasText: `${row.firstName} ${row.lastName}` });
          await expect(item).toHaveAttribute(
            'data-position',
            String(row.position),
          );
          if (row.goals === 0)
            await expect(item).not.toHaveAttribute('data-podium', /.+/);
        }
        const lastName = full.scorers.find(
          (r) => r.lastName === f.suffix && r.goals > 0,
        );
        await search.fill(`${lastName.firstName} ${lastName.lastName}`);
        await expect(page.getByRole('listitem')).toHaveCount(1);
        await expect(page.getByRole('listitem')).toHaveAttribute(
          'data-position',
          String(lastName.position),
        );
        await search.fill('NoSuchPlayer-unique');
        await expect(
          page.getByText('Nenhum jogador encontrado.'),
        ).toBeVisible();
        await search.fill(f.suffix);
        await noOverflow(page);
        await snapshot(page, `${user.role}-${viewport.width}-stats.png`);
        await choosePeriod(
          page,
          display(f.previousDay),
          display(f.previousDay),
        );
        const previous = await (
          await context.request.get(
            `${base}/api/statistics?from=${f.previousDay}&to=${f.previousDay}&search=${f.suffix}`,
          )
        ).json();
        assert.equal(previous.scorers.length, 4);
        await expect(
          page
            .getByRole('list', { name: 'Ranking de artilharia' })
            .locator('li'),
        ).toHaveCount(4);
        await choosePeriod(page, '01/01/1000', '01/01/1000');
        await expect(
          page.getByText('Nenhuma partida finalizada no período.'),
        ).toBeVisible();
        await noOverflow(page);
        if (user.role !== 'ORGANIZER') {
          assert.equal(
            (
              await context.request.get(
                `${base}/api/events/${f.active.detail.event.id}/highlights`,
              )
            ).status(),
            403,
          );
          await page.goto(`${base}/org/events/${f.active.detail.event.id}`, {
            waitUntil: 'domcontentloaded',
          });
          await expect(
            page.getByText('Você não tem permissão para acessar esta área.'),
          ).toBeVisible();
        } else {
          // Explicitly simulated transport delay/failure. Successful responses still come from the live API.
          let release;
          const gate = new Promise((resolve) => {
            release = resolve;
          });
          await page.route('**/api/statistics', async (route) => {
            await gate;
            await route.continue();
          });
          await page.goto(`${base}/stats`, { waitUntil: 'domcontentloaded' });
          await expect(
            page.getByText('Carregando estatísticas...', { exact: true }),
          ).toBeVisible();
          await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
          release();
          await expect(
            page.getByRole('list', { name: 'Ranking de artilharia' }),
          ).toBeVisible();
          await page.unroute('**/api/statistics');
          await page.route('**/api/statistics', (route) =>
            route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: '{"error":"fixture"}',
            }),
          );
          await page.reload({ waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('main').getByRole('alert')).toContainText(
            'Não foi possível carregar as estatísticas',
          );
          await page.unroute('**/api/statistics');
          await page
            .getByRole('button', { name: 'Tentar novamente', exact: true })
            .click();
          await expect(
            page.getByRole('list', { name: 'Ranking de artilharia' }),
          ).toBeVisible();
          // Partial/invalid periods are allowed while typing, rejected on submission, and never queried.
          await page
            .getByRole('button', { name: 'Selecionar período' })
            .click();
          const periodDialog = page.getByRole('dialog', {
            name: 'Selecionar período',
          });
          await periodDialog
            .getByLabel('Data inicial (DD/MM/AAAA)')
            .fill('31/02/2026');
          await expect(periodDialog.getByRole('alert')).toHaveCount(0);
          await periodDialog
            .getByRole('button', { name: 'Aplicar período' })
            .click();
          await expect(periodDialog.getByRole('alert')).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(
            page.getByRole('button', { name: 'Selecionar período' }),
          ).toBeFocused();
          await page.goto(`${base}/org/events/${f.active.detail.event.id}`, {
            waitUntil: 'domcontentloaded',
          });
          await page
            .getByRole('button', { name: 'Finalizar', exact: true })
            .click();
          let modal = page.getByRole('dialog', {
            name: 'Finalizar evento',
            exact: true,
          });
          await expect(
            modal
              .getByRole('region', { name: 'Artilheiro', exact: true })
              .getByRole('listitem'),
          ).toHaveCount(2);
          await expect(
            modal
              .getByRole('region', { name: 'Assistente', exact: true })
              .getByRole('listitem'),
          ).toHaveCount(2);
          const before = JSON.stringify(
            await f.Match.findById(f.active.mid).lean(),
          );
          await snapshot(page, `ORGANIZER-${viewport.width}-highlights.png`);
          await noOverflow(page);
          await modal
            .getByRole('button', { name: 'Confirmar finalização' })
            .click();
          await expect(modal).toHaveCount(0);
          await expect
            .poll(
              async () =>
                (await f.Event.findById(f.active.detail.event.id).lean())
                  .status,
            )
            .toBe('FINISHED');
          assert.equal(
            JSON.stringify(await f.Match.findById(f.active.mid).lean()),
            before,
          );
          await page.goto(`${base}/org/events/${f.empty.detail.event.id}`, {
            waitUntil: 'domcontentloaded',
          });
          await page
            .getByRole('button', { name: 'Finalizar', exact: true })
            .click();
          modal = page.getByRole('dialog', {
            name: 'Finalizar evento',
            exact: true,
          });
          await expect(
            modal.getByText('Sem artilheiro', { exact: true }),
          ).toBeVisible();
          await expect(
            modal.getByText('Sem assistente', { exact: true }),
          ).toBeVisible();
          await snapshot(page, `ORGANIZER-${viewport.width}-no-highlights.png`);
          await modal
            .getByRole('button', { name: 'Confirmar finalização' })
            .click();
          await expect(modal).toHaveCount(0);
          await page.goto(`${base}/org/events/${f.running.detail.event.id}`, {
            waitUntil: 'domcontentloaded',
          });
          await page
            .getByRole('button', { name: 'Finalizar', exact: true })
            .click();
          modal = page.getByRole('dialog', {
            name: 'Finalizar evento',
            exact: true,
          });
          await expect(
            modal.getByText('Sem artilheiro', { exact: true }),
          ).toBeVisible();
          await modal
            .getByRole('button', { name: 'Confirmar finalização' })
            .click();
          await expect(modal.getByRole('alert')).toBeVisible();
          assert.equal(
            (await f.Event.findById(f.running.detail.event.id).lean()).status,
            'ACTIVE',
          );
          assert.equal(
            (
              await context.request.get(
                `${base}/api/events/${f.previous.detail.event.id}/matches/${f.previous.mid}`,
              )
            ).status(),
            404,
          );
          const archived = await context.request.get(
            `${base}/api/events/${f.active.detail.event.id}/matches/${f.active.mid}`,
          );
          assert.equal(archived.status(), 409);
          const archivedBody = await archived.json();
          assert.equal(archivedBody.code, 'EVENT_INACTIVE');
          assert.equal(archivedBody.goals, undefined);
        }
        assert.deepEqual(errors, []);
        console.log(
          `PASS statistics real browser/API/MongoDB ${user.role} ${viewport.width}x${viewport.height}; period/search/tabs/permissions${user.role === 'ORGANIZER' ? '/highlights/finish/guards; simulated delay and failure recovery' : ''}`,
        );
      } catch (error) {
        const page = context.pages()[0];
        if (page) {
          await snapshot(page, `failure-${user.role}-${viewport.width}.png`);
          console.error(await page.locator('body').innerText());
        }
        throw error;
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser?.close();
  next?.kill();
  if (api) await new Promise((resolve) => api.close(resolve));
  await mongoose.disconnect();
}
