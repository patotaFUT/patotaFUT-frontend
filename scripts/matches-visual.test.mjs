// Visual-only fixtures: no API writes, real accounts or database access.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const base = 'http://localhost:3102';
const output = new URL('../.test-build/matches-visual/', import.meta.url);
await mkdir(output, { recursive: true });
const id = (n) => n.toString(16).padStart(24, '0');
const player = (n, name) => ({ id: id(n), name, participantType: 'USER' });
const teamA = {
  id: id(10),
  name: 'Time A',
  players: [
    player(
      20,
      'Nome de jogador bastante longo para verificar quebra de texto sem sobreposição',
    ),
    player(21, 'Jogador A2'),
  ],
};
const teamB = {
  id: id(11),
  name: 'Time B',
  players: [
    player(22, 'Jogador B1'),
    player(
      23,
      'NomeExtremamenteLongoSemEspaçosParaVerificarQuebraDePalavraNoCelular',
    ),
  ],
};
const fixture = {
  id: id(2),
  eventId: id(1),
  revision: 0,
  durationMinutes: 7,
  teamA,
  teamB,
  score: { teamA: 2, teamB: 1 },
  goals: [20, 21, 22].map((n, i) => ({
    id: id(30 + i),
    teamId: n < 22 ? teamA.id : teamB.id,
    scorerParticipantId: id(n),
    assistParticipantId: null,
    ownGoal: false,
    minute: 0,
  })),
};
const eventFixture = {
  id: id(1),
  name: 'Evento visual',
  date: '2026-10-16',
  startTime: '20:00',
  endTime: '21:00',
  status: 'ACTIVE',
  revision: 0,
  confirmedCount: 4,
  waitingCount: 0,
  playersPerTeam: 2,
  formationExists: true,
  ownPresence: null,
  ownAllocated: false,
  ownParticipantId: null,
};
const server = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--port',
    '3102',
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
server.stdout.on('data', (data) => {
  startup = (startup + data).slice(-5000);
});
server.stderr.on('data', (data) => {
  startup = (startup + data).slice(-5000);
});
async function buttonColor(button, token) {
  const expected = await button.evaluate((node, name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    node.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
  await expect(button).toHaveCSS('background-color', expected);
  await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
}
try {
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null) throw new Error(startup);
        try {
          return (await fetch(`${base}/org/matches`)).status;
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
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage(),
        errors = [],
        writes = [];
      let phase = 'PENDING';
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route(`${base}/api/**`, async (route) => {
        const req = route.request();
        if (req.method() !== 'GET') writes.push(req.method());
        const path = new URL(req.url()).pathname;
        if (path === '/api/events') {
          return route.fulfill({
            status: 200,
            json: {
              items: [
                eventFixture,
                { ...eventFixture, id: id(3), name: 'Outro evento visual' },
              ],
              nextCursor: null,
            },
          });
        }
        const json =
          path === '/api/auth/me'
            ? {
                user: {
                  id: id(99),
                  firstName: 'Visual',
                  lastName: 'Fixture',
                  email: 'visual@example.invalid',
                  role: 'ADMIN',
                },
              }
            : {
                ...fixture,
                status: phase,
                ...(phase === 'PENDING'
                  ? { goals: [], score: { teamA: 0, teamB: 0 } }
                  : {}),
                startedAt:
                  phase === 'PENDING' ? null : new Date().toISOString(),
              };
        await route.fulfill({ status: 200, json });
      });
      await page.goto(`${base}/org/matches/${id(1)}/${id(2)}`, {
        waitUntil: 'domcontentloaded',
      });
      const start = page.getByRole('button', { name: 'Iniciar', exact: true });
      await expect(start).toBeVisible();
      await buttonColor(start, '--color-primary');
      const remove = page.getByRole('button', {
        name: 'Excluir súmula pendente',
        exact: true,
      });
      await buttonColor(remove, '--color-error');
      await start.focus();
      await expect(start).toBeFocused();
      assert.notEqual(
        await start.evaluate((n) => getComputedStyle(n).outlineStyle),
        'none',
      );
      await remove.hover();
      await expect(remove).toHaveCSS('color', 'rgb(255, 255, 255)');
      // Pressed appearance without activating a destructive action.
      await page.mouse.down();
      await expect(remove).toHaveCSS('filter', 'brightness(0.9)');
      await page.mouse.move(1, 1);
      await page.mouse.up();
      const teams = page.getByRole('region', {
        name: 'Times da partida',
        exact: true,
      });
      const a = teams.getByRole('region', { name: 'Time A', exact: true });
      const b = teams.getByRole('region', { name: 'Time B', exact: true });
      const track = teams.locator(':scope > div').first();
      const firstNode = await a.elementHandle();
      await expect(a.getByRole('button').first()).toBeDisabled();
      await expect(a.getByRole('button').first()).toHaveCSS(
        'opacity',
        String(
          Number(
            await page.evaluate(() =>
              getComputedStyle(document.documentElement)
                .getPropertyValue('--opacity-disabled')
                .trim(),
            ),
          ),
        ),
      );
      if (viewport.width < 1024) {
        await expect(teams).toHaveAttribute(
          'aria-roledescription',
          'carrossel',
        );
        await teams
          .getByRole('button', { name: 'Próximo card', exact: true })
          .focus();
        await page.keyboard.press('Enter');
        await expect(
          teams.getByRole('button', { name: 'Mostrar card 2' }),
        ).toHaveAttribute('aria-current', 'true');
        await track.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(
          teams.getByRole('button', { name: 'Mostrar card 1' }),
        ).toHaveAttribute('aria-current', 'true');
        await page.keyboard.press('ArrowRight');
        await expect(
          teams.getByRole('button', { name: 'Mostrar card 2' }),
        ).toHaveAttribute('aria-current', 'true');
        await teams
          .getByRole('button', { name: 'Card anterior', exact: true })
          .click();
        await expect(
          teams.getByRole('button', { name: 'Mostrar card 1' }),
        ).toHaveAttribute('aria-current', 'true');
        await track.scrollIntoViewIfNeeded();
        const box = await track.boundingBox();
        assert.ok(box);
        const cdp = await context.newCDPSession(page);
        const y = box.y + Math.min(80, box.height / 2),
          from = box.x + box.width * 0.85,
          to = box.x + box.width * 0.15;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: from, y }],
        });
        for (let step = 1; step <= 10; step++)
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: from + ((to - from) * step) / 10, y }],
          });
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        await expect(
          teams.getByRole('button', { name: 'Mostrar card 2' }),
        ).toHaveAttribute('aria-current', 'true');
        await cdp.detach();
        // Both team nodes stay mounted while sliding.
        assert.equal(
          await a.evaluate((node, previous) => node === previous, firstNode),
          true,
        );
      } else {
        await expect(
          teams.getByRole('button', { name: 'Próximo card', exact: true }),
        ).toHaveCount(0);
        await expect(track).not.toHaveAttribute('tabindex', '0');
        const left = await a.boundingBox(),
          right = await b.boundingBox();
        assert.ok(
          left &&
            right &&
            Math.abs(left.y - right.y) < 2 &&
            right.x >= left.x + left.width,
        );
        assert.equal(
          await track.evaluate((node) => node.scrollWidth <= node.clientWidth),
          true,
        );
      }
      for (const row of await teams.locator('li').all()) {
        const result = await row.evaluate((node) => {
          const name = node.children[0],
            group = node.children[1];
          const n = name.getBoundingClientRect(),
            g = group.getBoundingClientRect();
          const count = group.children[0].getBoundingClientRect(),
            ball = group.children[1].getBoundingClientRect();
          return {
            justify: getComputedStyle(node).justifyContent,
            grouped: group.children.length === 2,
            overlap: n.right > g.left + 1,
            countCenter: count.y + count.height / 2,
            ballCenter: ball.y + ball.height / 2,
            overflow: node.scrollWidth > node.clientWidth,
          };
        });
        assert.equal(result.justify, 'space-between');
        assert.equal(result.grouped, true);
        assert.equal(result.overlap, false);
        assert.equal(result.overflow, false);
        assert.ok(Math.abs(result.countCenter - result.ballCenter) < 2);
      }
      phase = 'IN_PROGRESS';
      await page.getByRole('button', { name: 'Atualizar súmulas' }).click();
      const own = page.getByRole('button', { name: 'Gol contra', exact: true });
      await expect(own).toBeVisible();
      await buttonColor(own, '--color-warning');
      const currentTeams = page.getByRole('region', {
        name: 'Times da partida',
        exact: true,
      });
      if (viewport.width < 1024)
        await currentTeams
          .getByRole('button', { name: 'Mostrar card 2' })
          .click();
      await currentTeams
        .getByRole('button', {
          name: 'Registrar gol de Jogador B1',
          exact: true,
        })
        .click();
      const modal = page.getByRole('dialog', { name: 'Goool', exact: true });
      await expect(modal).toBeVisible();
      await expect(
        modal.getByRole('combobox', { name: 'Autor do gol', exact: true }),
      ).toHaveValue(id(22));
      await modal.getByRole('button', { name: 'Fechar' }).click();
      await expect(
        currentTeams
          .getByRole('region', { name: 'Time B', exact: true })
          .locator('li')
          .first(),
      ).toContainText('1 gols');
      assert.deepEqual(writes, []);
      const overflow = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth > innerWidth,
        y: document.documentElement.scrollHeight > innerHeight,
      }));
      assert.deepEqual(overflow, { x: false, y: false });
      await page.getByRole('main').evaluate((node) => {
        node.scrollTop = 0;
      });
      await page.screenshot({
        path: fileURLToPath(new URL(`${viewport.width}-teams.png`, output)),
      });
      if (viewport.width === 1440) {
        await page.goto(`${base}/org/matches`, {
          waitUntil: 'domcontentloaded',
        });
        const catalog = page.getByRole('region', {
          name: 'Eventos para súmulas',
        });
        await expect(catalog).toHaveAttribute(
          'aria-roledescription',
          'carrossel',
        );
        await catalog
          .getByRole('button', { name: 'Próximo card', exact: true })
          .click();
        await expect(
          catalog.getByRole('button', { name: 'Mostrar card 2' }),
        ).toHaveAttribute('aria-current', 'true');
      }
      assert.deepEqual(errors, []);
      console.log(
        `PASS visual teams/colors/keyboard/touch/overflow ${viewport.width}x${viewport.height}`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  server.kill();
}
