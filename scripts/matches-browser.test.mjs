// Real Chromium -> Next proxy -> Express -> isolated local MongoDB replica set.
// No API interception. Never loads or uses a production MongoDB URI.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import express from '../../patotaFUT-API/node_modules/express/index.js';
import mongoose from '../../patotaFUT-API/node_modules/mongoose/index.js';
import { liveFixture } from '../../patotaFUT-API/scripts/helpers/matches-live-fixture.mjs';
import { issueAccessToken } from '../../patotaFUT-API/dist/security/tokens.js';
import { createAuthRoutes } from '../../patotaFUT-API/dist/routes/auth.routes.js';
import { createEventRoutes } from '../../patotaFUT-API/dist/routes/event.routes.js';
import { AuthError } from '../../patotaFUT-API/dist/services/auth.service.js';
import { EventError } from '../../patotaFUT-API/dist/services/event-error.js';

const base = 'http://localhost:3101';
const output = new URL('../.test-build/matches-browser/', import.meta.url);
await mkdir(output, { recursive: true });
const secrets = {
  access: 'matches-local-access-'.repeat(4),
  refresh: 'matches-local-refresh-'.repeat(4),
};
const config = {
  secrets,
  csrfSecret: 'matches-local-csrf-'.repeat(4),
  secure: false,
  sameSite: 'lax',
  origins: [base],
  googleClientId: undefined,
};
let browser, next, api;
try {
  const f = await liveFixture();
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/auth', createAuthRoutes(config));
  app.use('/events', createEventRoutes(config));
  app.use((error, _req, res, _next) => {
    const expected = error instanceof AuthError || error instanceof EventError;
    if (!expected) console.error('Unexpected API failure:', error.message);
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
      '3101',
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
  next.stdout.on('data', (data) => {
    startup = (startup + data.toString()).slice(-6000);
  });
  next.stderr.on('data', (data) => {
    startup = (startup + data.toString()).slice(-6000);
  });
  // Condition-based readiness, no fixed startup sleep.
  await expect
    .poll(
      async () => {
        if (next.exitCode !== null) throw new Error(`Next failed: ${startup}`);
        try {
          return (await fetch(`${base}/api/auth/me`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(401);
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    for (const user of [f.player, f.admin, f.organizer]) {
      const detail = await f.createEvent(),
        eid = detail.event.id;
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 1000,
        reducedMotion: 'reduce',
      });
      try {
        await context.addCookies([
          {
            name: 'patotafut_access',
            value: issueAccessToken(user.id, secrets, new Date()),
            url: base,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const page = await context.newPage(),
          errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${base}/org/matches`, {
          waitUntil: 'domcontentloaded',
        });
        if (user.role === 'PLAYER') {
          await expect(
            page.getByText('Permissão insuficiente para acessar esta página.'),
          ).toBeVisible();
          assert.equal(
            (
              await context.request.get(`${base}/api/events/${eid}/matches`)
            ).status(),
            403,
          );
          const csrf = (
            await (await context.request.get(`${base}/api/auth/csrf`)).json()
          ).csrfToken;
          for (const action of [
            'start',
            'delete',
            'finish',
            'goals',
            'goals/000000000000000000000001/edit',
            'goals/000000000000000000000001/delete',
          ]) {
            const response = await context.request.post(
              `${base}/api/events/${eid}/matches/000000000000000000000001/${action}`,
              {
                data: {
                  revision: 0,
                  ...(action === 'finish' ? { confirmed: true } : {}),
                },
                headers: { Origin: base, 'X-CSRF-Token': csrf },
              },
            );
            assert.equal(response.status(), 403);
          }
          assert.equal(
            (
              await context.request.post(`${base}/api/events/${eid}/matches`, {
                data: f.input(detail),
                headers: { Origin: base, 'X-CSRF-Token': csrf },
              })
            ).status(),
            403,
          );
          await page.goto(`${base}/org/matches/${eid}`, {
            waitUntil: 'domcontentloaded',
          });
          await expect(
            page.getByText('Permissão insuficiente para acessar esta página.'),
          ).toBeVisible();
        } else {
          const create = async () => {
            await page.goto(`${base}/org/matches`, {
              waitUntil: 'domcontentloaded',
            });
            await page
              .getByRole('searchbox', { name: 'Nome do evento' })
              .fill(detail.event.name);
            await page
              .getByRole('button', { name: 'Buscar', exact: true })
              .click();
            await expect(
              page.getByRole('heading', {
                name: detail.event.name,
                exact: true,
              }),
            ).toBeVisible();
            await expect(
              page
                .getByRole('region', { name: 'Eventos para súmulas' })
                .locator('article'),
            ).toHaveCount(1);
            await page.screenshot({
              path: fileURLToPath(
                new URL(`${user.role}-${viewport.width}-catalog.png`, output),
              ),
            });
            await page
              .getByRole('button', { name: 'Criar súmula', exact: true })
              .click();
            const modal = page.getByRole('dialog', { name: 'Criar súmula' });
            await expect(modal).toBeVisible();
            await modal.getByLabel('Time A').selectOption(detail.teams[0].id);
            await modal.getByLabel('Time B').selectOption(detail.teams[1].id);
            await modal
              .getByRole('spinbutton', { name: 'Duração em minutos' })
              .fill('3');
            await page.screenshot({
              path: fileURLToPath(
                new URL(`${user.role}-${viewport.width}-create.png`, output),
              ),
            });
            await modal
              .getByRole('button', { name: 'Criar súmula', exact: true })
              .click();
            await expect(page).toHaveURL(
              new RegExp(`/org/matches/${eid}/[a-f0-9]{24}$`),
            );
            await expect(
              page.getByRole('button', { name: 'Iniciar', exact: true }),
            ).toBeVisible();
            return page.url().split('/').at(-1);
          };
          const deletedId = await create();
          await page
            .getByRole('button', {
              name: 'Excluir súmula pendente',
              exact: true,
            })
            .click();
          await page
            .getByRole('button', { name: 'Confirmar exclusão', exact: true })
            .click();
          await expect(page).toHaveURL(`${base}/org/matches/${eid}`);
          assert.equal(await f.Match.findById(deletedId).lean(), null);
          const mid = await create();
          let saved = await f.Match.findById(mid).lean();
          assert.equal(saved.status, 'PENDING');
          assert.equal(saved.startedAt ?? null, null);
          const post = async (route, data) => {
            const csrf = (
              await (await context.request.get(`${base}/api/auth/csrf`)).json()
            ).csrfToken;
            return context.request.post(`${base}/api/events/${eid}/${route}`, {
              data,
              headers: { Origin: base, 'X-CSRF-Token': csrf },
            });
          };
          assert.equal(
            (
              await context.request.post(`${base}/api/events/${eid}/matches`, {
                data: f.input(detail),
              })
            ).status(),
            403,
          );
          const fresh = await f.events.detail(f.organizer.id, eid);
          assert.equal((await post('matches', f.input(fresh))).status(), 409);
          for (const status of ['FINISHED', 'CANCELED'])
            await assert.rejects(
              () =>
                f.events.status(f.organizer.id, eid, {
                  revision: fresh.event.revision,
                  status,
                  confirmed: true,
                }),
              (e) => e.status === 409,
            );
          await page
            .getByRole('button', { name: 'Iniciar', exact: true })
            .click();
          await expect(
            page.getByText('Em andamento', { exact: true }),
          ).toBeVisible();
          saved = await f.Match.findById(mid).lean();
          assert.ok(saved.startedAt);
          assert.equal(saved.status, 'IN_PROGRESS');
          await expect(
            page.getByRole('button', {
              name: 'Excluir súmula pendente',
              exact: true,
            }),
          ).toHaveCount(0);
          const match = await f.matches.detail(user.id, eid, mid);
          const [scorer, assist] = match.teamA.players;
          await page
            .getByRole('button', {
              name: `Registrar gol de ${scorer.name}`,
              exact: true,
            })
            .click();
          let modal = page.getByRole('dialog', { name: 'Goool', exact: true });
          await modal
            .getByRole('combobox', { name: 'Assistência', exact: true })
            .selectOption(assist.id);
          await page.screenshot({
            path: fileURLToPath(
              new URL(`${user.role}-${viewport.width}-goal.png`, output),
            ),
          });
          await expect(
            modal
              .getByRole('combobox', { name: 'Assistência', exact: true })
              .locator(`option[value="${scorer.id}"]`),
          ).toHaveCount(0);
          await modal
            .getByRole('button', { name: 'Confirmar', exact: true })
            .click();
          await expect(
            page
              .getByRole('region', { name: 'Gols registrados' })
              .getByText(`0′ — ${scorer.name}`, { exact: false }),
          ).toBeVisible();
          assert.equal(
            (
              await f.Match.findById(mid).lean()
            ).goals[0].assistParticipantId.toString(),
            assist.id,
          );
          await page
            .getByRole('button', { name: 'Editar gol', exact: true })
            .click();
          modal = page.getByRole('dialog', { name: 'Editar gol', exact: true });
          await modal
            .getByRole('combobox', { name: 'Assistência', exact: true })
            .selectOption('');
          await modal
            .getByRole('button', { name: 'Confirmar', exact: true })
            .click();
          await expect(modal).toHaveCount(0);
          assert.equal(
            (await f.Match.findById(mid).lean()).goals[0].assistParticipantId ??
              null,
            null,
          );
          await page
            .getByRole('button', { name: 'Excluir gol', exact: true })
            .click();
          await expect(page.getByText('Nenhum gol registrado.')).toBeVisible();
          assert.equal((await f.Match.findById(mid).lean()).goals.length, 0);
          await page
            .getByRole('button', { name: 'Gol contra', exact: true })
            .click();
          modal = page.getByRole('dialog', { name: 'Gol contra', exact: true });
          await modal
            .getByLabel('Time que recebe o ponto')
            .selectOption(match.teamB.id);
          await modal
            .getByRole('button', { name: 'Confirmar', exact: true })
            .click();
          await expect(
            page.getByText(`0′ — Gol contra para ${match.teamB.name}`),
          ).toBeVisible();
          saved = await f.Match.findById(mid).lean();
          assert.equal(saved.goals[0].ownGoal, true);
          assert.equal(saved.goals[0].scorerParticipantId ?? null, null);
          await page.getByRole('main').evaluate((node) => {
            node.scrollTop = 0;
          });
          await expect
            .poll(() =>
              page.getByRole('main').evaluate((node) => node.scrollTop),
            )
            .toBe(0);
          await page.screenshot({
            path: fileURLToPath(
              new URL(`${user.role}-${viewport.width}-match.png`, output),
            ),
            fullPage: true,
          });
          if (user.role === 'ADMIN') {
            await page.clock.install({ time: Date.now() });
            await page.clock.fastForward(181000);
            await page.evaluate(() =>
              document.dispatchEvent(new Event('visibilitychange')),
            );
            await expect(
              page.getByLabel('Tempo restante', { exact: true }),
            ).toHaveText('00:00');
            assert.equal(
              (await f.Match.findById(mid).lean()).status,
              'IN_PROGRESS',
            );
          }
          const overflow = await page.evaluate(() => ({
            x: document.documentElement.scrollWidth > innerWidth,
            y: document.documentElement.scrollHeight > innerHeight,
          }));
          assert.deepEqual(overflow, { x: false, y: false });
          await page
            .getByRole('button', { name: 'Finalizar súmula', exact: true })
            .click();
          modal = page.getByRole('dialog', {
            name: 'Finalizar súmula',
            exact: true,
          });
          await expect(modal).toBeVisible();
          assert.equal(
            (await f.Match.findById(mid).lean()).status,
            'IN_PROGRESS',
          );
          await modal
            .getByRole('button', { name: 'Fechar', exact: true })
            .click();
          assert.equal(
            (await f.Match.findById(mid).lean()).status,
            'IN_PROGRESS',
          );
          await page
            .getByRole('button', { name: 'Finalizar súmula', exact: true })
            .click();
          await page
            .getByRole('button', { name: 'Confirmar finalização', exact: true })
            .click();
          await expect(page).toHaveURL(`${base}/org/matches/${eid}`);
          await expect(
            page.getByText(
              'Nenhuma súmula pendente ou em andamento neste evento.',
            ),
          ).toBeVisible();
          saved = await f.Match.findById(mid).lean();
          assert.equal(saved.status, 'FINISHED');
          assert.equal(saved.goals.length, 1);
          assert.equal(
            (
              await context.request.get(
                `${base}/api/events/${eid}/matches/${mid}`,
              )
            ).status(),
            404,
          );
          assert.deepEqual(
            (
              await (
                await context.request.get(
                  `${base}/api/events/${eid}/matches?status=FINISHED`,
                )
              ).json()
            ).matches,
            [],
          );
          assert.equal(
            (
              await post(`matches/${mid}/goals/${saved.goals[0]._id}/delete`, {
                revision: saved.revision,
              })
            ).status(),
            404,
          );
          await page.goto(`${base}/org/matches/${eid}/${mid}`, {
            waitUntil: 'domcontentloaded',
          });
          await expect(page.getByRole('main').getByRole('alert')).toContainText(
            'não encontrada',
          );
          await expect(
            page.getByRole('button', { name: 'Finalizar súmula', exact: true }),
          ).toHaveCount(0);
        }
        assert.deepEqual(errors, []);
        console.log(
          `PASS real browser/API/MongoDB ${user.role} ${viewport.width}x${viewport.height}`,
        );
      } catch (error) {
        const page = context.pages()[0];
        if (page) {
          await page.screenshot({
            path: fileURLToPath(
              new URL(`failure-${user.role}-${viewport.width}.png`, output),
            ),
          });
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
