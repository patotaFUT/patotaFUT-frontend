// Real Chromium, intercepted authorized role fixtures. No real credentials or database writes.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const id = (n) => n.toString(16).padStart(24, '0');
const output = new URL('../.test-build/navigation/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    for (const role of ['PLAYER', 'ADMIN', 'ORGANIZER']) {
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const teams = ['Time 1', 'Time 2', 'Reservas'].map((name, index) => ({
        id: id(100 + index),
        name,
        type: index === 2 ? 'RESERVES' : 'TEAM',
        members: Array.from({ length: index === 2 ? 2 : 12 }, (_, member) => ({
          id: id(index * 12 + member + 1),
          name: `Participante ${index * 12 + member + 1}`,
          participantType: member === 1 ? 'GUEST' : 'USER',
          allocated: true,
        })),
      }));
      const event = {
        id: id(200),
        name: 'Evento de teste',
        date: '2026-10-10',
        startTime: '20:00',
        endTime: '21:30',
        status: 'ACTIVE',
        revision: 1,
        confirmedCount: 27,
        ownPresence: 'CONFIRMED',
        ownAllocated: true,
        ownParticipantId: id(1),
      };
      let allocated = true;
      let rejectParticipants = false;
      let mutations = 0;
      await page.route('http://localhost:8080/**', async (route) => {
        const url = new URL(route.request().url());
        let status = 200;
        let body;
        if (url.pathname === '/auth/me')
          body = {
            user: {
              id: id(999),
              email: 'navigation@example.invalid',
              firstName: 'Navigation',
              lastName: 'Test',
              role,
            },
          };
        else if (url.pathname === '/auth/csrf')
          body = { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` };
        else if (route.request().method() !== 'GET') {
          mutations++;
          status = 409;
          body = { error: 'Os dados mudaram. Revise sua ação.' };
        } else if (url.pathname.endsWith('/participants')) {
          if (rejectParticipants) {
            status = 503;
            body = { error: 'Unavailable' };
          } else
            body = {
              items: [
                ...teams
                  .flatMap((team) => team.members)
                  .map((member) => ({ ...member, allocated })),
                {
                  id: id(90),
                  name: 'Sem alocação',
                  participantType: 'USER',
                  allocated: false,
                },
              ],
              nextCursor: null,
              total: 27,
              revision: 1,
            };
        } else if (url.pathname === '/events')
          body = {
            items: [event, { ...event, id: id(201), name: 'Segundo evento' }],
            nextCursor: url.searchParams.has('cursor') ? null : id(200),
          };
        else body = { event, teams };
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3000',
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      });
      const menu = page.getByRole('navigation', { name: 'Menu principal' });
      const main = page.locator('#events-main');
      async function close() {
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Fechar', exact: true })
          .click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      async function capture(name) {
        await page.screenshot({
          path: fileURLToPath(
            new URL(`${viewport.width}-${role}-${name}.png`, output),
          ),
        });
      }
      await page.goto('http://localhost:3000/events');
      await expect(main.getByRole('article')).toHaveCount(2);
      await expect(
        menu.getByRole('link', { name: 'Eventos ativos' }),
      ).toHaveAttribute('aria-current', 'page');
      if (role === 'PLAYER') {
        await expect(menu.getByRole('link', { name: 'Gerenciar' })).toHaveCount(
          0,
        );
        for (const [participant, title] of [
          [id(1), 'Time 1'],
          [id(25), 'Reservas'],
          [null, 'Meu time'],
        ]) {
          event.ownParticipantId = participant;
          event.ownAllocated = participant !== null;
          await main
            .getByRole('button', { name: 'Ver time', exact: true })
            .first()
            .click();
          const dialog = page.getByRole('dialog');
          await expect(
            dialog.getByRole('heading', { name: title, exact: true }),
          ).toBeVisible();
          assert.equal(new URL(page.url()).pathname, '/events');
          await expect(
            dialog.getByRole('button', { name: 'Editar', exact: true }),
          ).toHaveCount(0);
          if (participant) {
            await expect(
              dialog.getByText('(Você)', { exact: false }),
            ).toHaveCount(1);
            await expect(
              dialog.getByText('(Convidado)', { exact: false }),
            ).toHaveCount(1);
            await expect(dialog.getByRole('listitem')).toHaveCount(
              title === 'Reservas' ? 2 : 12,
            );
          } else
            await expect(
              dialog.getByText('Você ainda não está alocado', { exact: false }),
            ).toBeVisible();
          await capture(
            title === 'Meu time'
              ? 'unallocated'
              : title === 'Reservas'
                ? 'reserves'
                : 'own-team',
          );
          if (participant) {
            await dialog.getByRole('listitem').last().scrollIntoViewIfNeeded();
            await expect(dialog.getByRole('listitem').last()).toBeInViewport();
            await expect(
              dialog.getByRole('button', { name: 'Fechar', exact: true }),
            ).toBeInViewport();
          }
          await close();
        }
        await page.goto(`http://localhost:3000/org/events/${event.id}/teams`);
        await expect(
          main.getByText('Você não tem permissão para acessar esta área.'),
        ).toBeVisible();
        await expect(main.getByRole('button', { name: 'Editar' })).toHaveCount(
          0,
        );
        await page.goto(`http://localhost:3000/events/${event.id}`);
        const card = main.getByRole('article', { name: 'Time 1', exact: true });
        const button = card.getByRole('button', {
          name: 'Ver jogadores',
          exact: true,
        });
        await expect(button).toBeVisible();
        const cardBox = await card.boundingBox();
        const buttonBox = await button.boundingBox();
        assert.ok(
          Math.abs(
            cardBox.x + cardBox.width / 2 - buttonBox.x - buttonBox.width / 2,
          ) < 2,
        );
        await capture('single-button');
      } else {
        await menu
          .getByRole('link', { name: 'Gerenciar', exact: true })
          .click();
        await expect(page).toHaveURL(/\/org\/events$/);
        await expect(
          menu.getByRole('link', { name: 'Gerenciar' }),
        ).toHaveAttribute('aria-current', 'page');
        await expect(
          main.getByRole('button', { name: 'Criar evento', exact: true }),
        ).toHaveCount(role === 'ORGANIZER' ? 1 : 0);
        await expect(
          main.getByRole('button', { name: 'Formar times', exact: true }),
        ).toHaveCount(role === 'ORGANIZER' ? 2 : 0);
        await main
          .getByRole('button', { name: 'Jogadores confirmados', exact: true })
          .first()
          .click();
        let dialog = page.getByRole('dialog');
        await expect(
          dialog.getByText('Participantes alocados não podem ser excluídos.', {
            exact: true,
          }),
        ).toBeVisible();
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        if (role === 'ORGANIZER') {
          await expect(
            dialog.getByRole('button', {
              name: 'Cancelar presença de Participante 1',
              exact: true,
            }),
          ).toBeDisabled();
          await expect(
            dialog.getByRole('button', {
              name: 'Cancelar presença de Participante 1',
              exact: true,
            }),
          ).toHaveAttribute('aria-describedby', 'allocated-participants-note');
          await dialog
            .getByRole('textbox', { name: 'Nome do convidado', exact: true })
            .fill('Convidado teste');
          await dialog
            .getByRole('button', { name: 'Adicionar', exact: true })
            .click();
          await expect(dialog.getByRole('alert')).toBeVisible();
          assert.equal(mutations, 1);
        }
        await capture('participants');
        await close();
        await expect(main.getByRole('alert')).toHaveCount(0);
        allocated = false;
        await main
          .getByRole('button', { name: 'Jogadores confirmados', exact: true })
          .first()
          .click();
        await expect(
          page
            .getByRole('dialog')
            .getByText('Participantes alocados não podem ser excluídos.', {
              exact: true,
            }),
        ).toHaveCount(0);
        await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(
          0,
        );
        await close();
        allocated = true;
        rejectParticipants = true;
        await main
          .getByRole('button', { name: 'Jogadores confirmados', exact: true })
          .first()
          .click();
        await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
        await close();
        rejectParticipants = false;
        await main
          .getByRole('button', { name: 'Jogadores confirmados', exact: true })
          .first()
          .click();
        await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(
          0,
        );
        await close();
        await main
          .getByRole('textbox', { name: 'Buscar eventos pelo nome' })
          .fill('Evento');
        await main
          .getByRole('button', { name: 'Buscar eventos', exact: true })
          .click();
        await expect(page).toHaveURL(/q=Evento/);
        await main
          .getByRole('button', {
            name: 'Próxima página de eventos',
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/page=1/);
        await main
          .getByRole('button', { name: 'Próximo card', exact: true })
          .click();
        await expect(
          main.getByRole('button', { name: 'Mostrar card 2' }),
        ).toHaveAttribute('aria-current', 'true');
        await main.evaluate((node) => {
          node.scrollTop = node.scrollHeight;
        });
        const beforeScroll = await main.evaluate((node) => node.scrollTop);
        await main
          .getByRole('link', { name: 'Times do evento', exact: true })
          .nth(1)
          .click();
        await expect(page).toHaveURL(/\/org\/events\/.*\/teams\?returnTo=/);
        await expect(
          main.getByRole('button', { name: 'Editar', exact: true }),
        ).toHaveCount(3);
        const savedReturn = new URL(page.url()).searchParams.get('returnTo');
        const savedScroll = Number(
          new URL(savedReturn, 'http://localhost:3000').searchParams.get(
            'scroll',
          ),
        );
        assert.ok(savedScroll <= beforeScroll); // Playwright may scroll the clicked link into view first.
        await page.reload();
        await main.getByRole('link', { name: 'Voltar', exact: true }).click();
        await expect(page).toHaveURL(/q=Evento.*page=1.*slide=1/);
        await expect(
          main.getByRole('textbox', { name: 'Buscar eventos pelo nome' }),
        ).toHaveValue('Evento');
        await expect(
          main.getByRole('button', { name: 'Mostrar card 2' }),
        ).toHaveAttribute('aria-current', 'true');
        await expect
          .poll(() => main.evaluate((node) => node.scrollTop))
          .toBeGreaterThanOrEqual(Math.max(0, savedScroll - 3));
        await page.goBack();
        await expect(page).toHaveURL(/\/teams\?returnTo=/);
        await page.goForward();
        await expect(page).toHaveURL(/slide=1/);
        await capture('organization');
        await page.goto(
          `http://localhost:3000/org/events/${event.id}/teams?returnTo=${encodeURIComponent('https://evil.invalid')}`,
        );
        await expect(
          main.getByRole('link', { name: 'Voltar', exact: true }),
        ).toHaveAttribute(
          'href',
          role === 'ORGANIZER' ? `/org/events/${event.id}` : '/org/events',
        );
        await page.goto(`http://localhost:3000/events/${event.id}`);
        await expect(page).toHaveURL(
          new RegExp(`/org/events/${event.id}/teams\\?returnTo=`),
        );
        await expect(
          main.getByRole('button', { name: 'Editar', exact: true }),
        ).toHaveCount(3);
        await page.goto(`http://localhost:3000/events/${event.id}?manage=1`);
        await expect(page).toHaveURL(
          `http://localhost:3000/org/events/${event.id}`,
        );
        if (role === 'ADMIN')
          await expect(
            main.getByText('Você não tem permissão para acessar esta área.'),
          ).toBeVisible();
        else {
          await expect(
            main.getByRole('button', { name: 'Finalizar', exact: true }),
          ).toBeVisible();
          await expect(
            main.getByRole('link', { name: 'Voltar', exact: true }),
          ).toHaveAttribute('href', '/org/events');
        }
      }
      await menu
        .getByRole('link', { name: 'Estatísticas', exact: true })
        .click();
      await expect(page).toHaveURL('http://localhost:3000/stats');
      await expect(main.getByText('Em breve', { exact: true })).toBeVisible();
      await expect(
        menu.getByRole('link', { name: 'Estatísticas' }),
      ).toHaveAttribute('aria-current', 'page');
      await capture('stats');
      await menu.getByRole('link', { name: 'Eventos ativos' }).click();
      await expect(page).toHaveURL('http://localhost:3000/events');
      await page.reload();
      await expect(main.getByRole('article')).toHaveCount(2);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${viewport.width}x${viewport.height} ${role}: roles, modals, menu, direct routes, reload, return/history`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
