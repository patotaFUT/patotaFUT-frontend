// Real Chromium + real API Service, intercepted transport and transactional memory double.
// No real accounts, cookies or MongoDB writes. Started-match fixture is explicitly seeded.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EventService } from '../../patotaFUT-API/dist/services/event.service.js';
import { eventFixture } from '../../patotaFUT-API/scripts/helpers/event-store-double.mjs';
const output = new URL('../.test-build/late-arrivals/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 390, height: 500 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const f = eventFixture();
    const service = new EventService(f.repository);
    const actor = f.organizer._id.toString();
    let detail = await service.create(actor, {
      name: 'Evento de teste incremental',
      date: '2020-01-01',
      startTime: '10:00',
      endTime: '11:00',
    });
    const id = detail.event.id;
    for (let i = 0; i < 11; i++)
      detail = await service.guest(actor, id, {
        revision: detail.event.revision,
        name: `Convidado ${i + 1}`,
      });
    detail = await service.form(actor, id, {
      revision: detail.event.revision,
      playersPerTeam: 5,
    });
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    let identity = actor;
    let failedSave = false;
    let slowSave = false;
    let swaps = 0;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('http://localhost:3000/api/**', async (route) => {
      const url = new URL(route.request().url());
      url.pathname = url.pathname.replace(/^\/api(?=\/)/, '');
      const path = url.pathname;
      const method = route.request().method();
      const headers = {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      };
      if (method === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      let result;
      let status = 200;
      const input = route.request().postDataJSON();
      try {
        if (path === '/auth/me') {
          const user = f
            .state()
            .users.find((u) => u._id.toString() === identity);
          result = {
            user: {
              id: identity,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
            },
          };
        } else if (path === '/auth/csrf')
          result = { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` };
        else if (path === '/events')
          result = await service.list(
            identity,
            Object.fromEntries(url.searchParams),
          );
        else if (path.endsWith('/participants'))
          result = await service.participants(
            identity,
            id,
            Object.fromEntries(url.searchParams),
          );
        else if (path.endsWith('/teams/swap')) {
          swaps++;
          if (slowSave)
            await new Promise((resolve) => setTimeout(resolve, 500));
          if (failedSave) {
            status = 503;
            result = { error: 'Não foi possível salvar a troca.' };
          } else result = await service.swap(identity, id, input);
        } else if (path.endsWith('/teams/incorporate'))
          result = await service.incorporate(identity, id, input);
        else if (path.endsWith('/teams/allocate'))
          result = await service.allocate(identity, id, input);
        else if (path.endsWith('/guests'))
          result = await service.guest(identity, id, input);
        else if (path.endsWith('/presence'))
          result = await service.presence(identity, id, input);
        else if (path.endsWith('/formation'))
          result = await service.form(identity, id, input);
        else result = await service.detail(identity, id);
      } catch (error) {
        status = error.status ?? 500;
        result = {
          error: error.status
            ? error.message
            : 'Não foi possível concluir a operação.',
        };
      }
      await route.fulfill({
        status,
        headers,
        contentType: 'application/json',
        body: JSON.stringify(result),
      });
    });
    const main = page.locator('#events-main');
    const menu = page.getByRole('navigation', { name: 'Menu principal' });
    const teamsPath = `/org/events/${id}/teams`;
    const editPath = `${teamsPath}/edit`;
    async function title(name) {
      await expect(page).toHaveTitle(`${name} | PatotaFUT`);
      await expect(
        page.getByRole('heading', { name, exact: true }).first(),
      ).toBeVisible();
    }
    async function choose() {
      const cards = main.getByRole('article');
      await cards
        .nth(0)
        .getByRole('button', { name: 'Selecionar', exact: true })
        .first()
        .click();
      await cards
        .nth(1)
        .getByRole('button', { name: 'Selecionar', exact: true })
        .first()
        .click();
    }
    await page.goto(`http://localhost:3000${teamsPath}`);
    await title('Times do evento');
    await main
      .getByRole('button', { name: 'Editar', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${editPath}\\?`));
    await title('Editar times');
    await page.reload();
    await title('Editar times');
    await expect(
      main.getByRole('link', { name: 'Voltar', exact: true }),
    ).toHaveCount(1);
    await expect(
      main.getByRole('button', { name: 'Voltar', exact: true }),
    ).toHaveCount(0);
    const stableHeader = await page.locator('header').boundingBox();
    const stableMenu = await menu.boundingBox();
    for (let i = 0; i < 3; i++) {
      await choose();
      await main.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      slowSave = true;
      const before = await main.evaluate((node) => node.scrollTop);
      await main
        .getByRole('button', { name: 'Confirmar troca', exact: true })
        .click();
      await expect(
        main.getByRole('button', { name: 'Confirmar troca', exact: true }),
      ).toBeDisabled();
      await expect(
        main.getByText('Troca realizada', { exact: true }),
      ).toBeVisible();
      await expect(
        main.getByRole('button', { name: 'Selecionado', exact: true }),
      ).toHaveCount(0);
      assert.equal(swaps, i + 1);
      assert.equal(new URL(page.url()).pathname, editPath);
      assert.ok(
        Math.abs((await main.evaluate((node) => node.scrollTop)) - before) < 60,
      );
    }
    const persisted = await service.detail(actor, id);
    for (const team of persisted.teams)
      for (const participant of team.members)
        await expect(
          main
            .getByRole('article', { name: team.name, exact: true })
            .getByText(`${participant.name} (Convidado)`, { exact: true }),
        ).toBeAttached();
    await choose();
    failedSave = true;
    slowSave = false;
    await main
      .getByRole('button', { name: 'Confirmar troca', exact: true })
      .click();
    await expect(main.getByRole('alert')).toBeVisible();
    await expect(
      main.getByRole('button', { name: 'Selecionado', exact: true }),
    ).toHaveCount(2);
    await expect(
      main.getByText('Troca realizada', { exact: true }),
    ).toHaveCount(0);
    assert.equal(new URL(page.url()).pathname, editPath);
    failedSave = false;
    await main
      .getByRole('button', { name: 'Confirmar troca', exact: true })
      .click();
    await expect(
      main.getByText('Troca realizada', { exact: true }),
    ).toBeVisible();
    await expect(
      main.getByRole('button', { name: 'Selecionado', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: fileURLToPath(
        new URL(`${viewport.width}x${viewport.height}-edit.png`, output),
      ),
    });
    assert.equal(
      (await page.locator('header').boundingBox()).y,
      stableHeader.y,
    );
    assert.equal((await menu.boundingBox()).y, stableMenu.y);
    await main.getByRole('link', { name: 'Voltar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${teamsPath}\\?`));
    await title('Times do evento');
    await page.goto(`http://localhost:3000/org/events/${id}`);
    await title('Gerenciar evento');
    // Prior authorized change leaving a vacancy, expressed only as test setup.
    const first = f.state().teams.find((t) => t.type === 'TEAM');
    const second = f.state().teams.filter((t) => t.type === 'TEAM')[1];
    const reserve = f.state().teams.find((t) => t.type === 'RESERVES');
    reserve.members.push(first.members.pop());
    f.state().matches.push({
      eventId: first.eventId,
      teamAId: first._id,
      teamBId: second._id,
      status: 'IN_PROGRESS',
      lineups: {
        teamA: first.members.map((m) => m.participantId),
        teamB: second.members.map((m) => m.participantId),
      },
      goals: [
        {
          teamId: first._id,
          scorerParticipantId: first.members[0].participantId,
        },
      ],
    });
    const history = JSON.stringify(f.state().matches);
    const originalIds = f
      .state()
      .teams.filter((t) => t.type === 'TEAM')
      .map((t) => t._id.toString());
    async function addGuest(name) {
      await main
        .getByRole('button', { name: 'Jogadores confirmados', exact: false })
        .first()
        .click();
      const modal = page.getByRole('dialog');
      await modal
        .getByRole('textbox', { name: 'Nome do convidado', exact: true })
        .fill(name);
      await modal
        .getByRole('button', { name: 'Adicionar', exact: true })
        .click();
      await expect(
        modal.getByRole('textbox', { name: 'Nome do convidado', exact: true }),
      ).toHaveValue('');
      await expect(
        modal.getByText(`${name} (Convidado) · Aguardando alocação`, {
          exact: true,
        }),
      ).toBeVisible();
      await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
    }
    await addGuest('Chegada tardia');
    assert.equal((await service.detail(actor, id)).event.waitingCount, 1);
    await main
      .getByRole('button', {
        name: 'Incorporar novos participantes',
        exact: true,
      })
      .click();
    await expect(
      main.getByText('Participantes incorporados', { exact: true }),
    ).toBeVisible();
    detail = await service.detail(actor, id);
    assert.equal(
      detail.teams.find((t) => t.id === first._id.toString()).members.length,
      5,
    );
    assert.equal(
      detail.teams.find((t) => t.type === 'RESERVES').members.length,
      2,
    );
    for (let i = 0; i < 3; i++) await addGuest(`Nova chegada ${i}`);
    detail = await service.detail(actor, id);
    await service.presence(f.player._id.toString(), id, {
      revision: detail.event.revision,
      status: 'CONFIRMED',
    });
    await page.reload();
    await title('Gerenciar evento');
    await main
      .getByRole('button', {
        name: 'Incorporar novos participantes',
        exact: true,
      })
      .click();
    await expect(
      main.getByText('Participantes incorporados', { exact: true }),
    ).toBeVisible();
    detail = await service.detail(actor, id);
    assert.equal(detail.teams.filter((t) => t.type === 'TEAM').length, 3);
    assert.equal(
      detail.teams.find((t) => t.type === 'RESERVES').members.length,
      1,
    );
    assert.equal(detail.event.waitingCount, 0);
    assert.deepEqual(
      detail.teams.filter((t) => originalIds.includes(t.id)).map((t) => t.id),
      originalIds,
    );
    assert.equal(JSON.stringify(f.state().matches), history);
    const groups = JSON.stringify(detail.teams);
    await main
      .getByRole('button', {
        name: 'Incorporar novos participantes',
        exact: true,
      })
      .click();
    await expect(
      main.getByRole('button', {
        name: 'Incorporar novos participantes',
        exact: true,
      }),
    ).toBeEnabled();
    assert.equal(
      JSON.stringify((await service.detail(actor, id)).teams),
      groups,
    );
    assert.equal(JSON.stringify(f.state().matches), history);
    await page.screenshot({
      path: fileURLToPath(
        new URL(
          `${viewport.width}x${viewport.height}-incorporation.png`,
          output,
        ),
      ),
    });
    await menu.getByRole('link', { name: 'Gerenciar', exact: true }).click();
    await title('Organização');
    await page.reload();
    await title('Organização');
    await menu
      .getByRole('link', { name: 'Eventos ativos', exact: true })
      .click();
    await title('Eventos ativos');
    await page.reload();
    await title('Eventos ativos');
    await menu.getByRole('link', { name: 'Estatísticas', exact: true }).click();
    await title('Estatísticas');
    // Permissions via direct access, without creating test accounts.
    for (const user of [f.admin, f.player]) {
      identity = user._id.toString();
      await page.goto(`http://localhost:3000${teamsPath}`);
      if (user.role === 'ADMIN') {
        await title('Times do evento');
        await expect(
          main.getByRole('button', {
            name: 'Incorporar novos participantes',
            exact: true,
          }),
        ).toHaveCount(0);
        await main
          .getByRole('button', { name: 'Editar', exact: true })
          .first()
          .click();
        await title('Editar times');
      } else
        await expect(
          main.getByText('Você não tem permissão para acessar esta área.'),
        ).toBeVisible();
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${viewport.width}x${viewport.height}: titles, consecutive swaps, failed save/selection, one back link, late guests/player, vacancies, new team/reserves, repeat, unchanged running match`,
    );
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('http://localhost:3000/api/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Sessão ausente' }),
    }),
  );
  for (const [path, name] of [
    ['/', 'Login'],
    ['/register', 'Cadastro'],
    ['/forgot-password', 'Recuperar senha'],
  ]) {
    await page.goto(`http://localhost:3000${path}`);
    await expect(page).toHaveTitle(`${name} | PatotaFUT`);
    await page.reload();
    await expect(page).toHaveTitle(`${name} | PatotaFUT`);
  }
  await context.close();
} finally {
  await browser.close();
}
