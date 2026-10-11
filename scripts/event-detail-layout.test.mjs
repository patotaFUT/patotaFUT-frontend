// Real Chromium presentation checks with intercepted API fixtures only.
// No authentication credentials or database writes are used.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../.test-build/event-detail-layout/', import.meta.url);
await mkdir(output, { recursive: true });
const eventId = '507f1f77bcf86cd799439011';
const id = (number) => number.toString(16).padStart(24, '0');
const teams = ['Time 1', 'Time 2', 'Reservas'].map((name, index) => ({
  id: id(index + 100),
  name,
  type: index === 2 ? 'RESERVES' : 'TEAM',
  members: Array.from({ length: index === 2 ? 1 : 12 }, (_, member) => ({
    id: id(index * 12 + member + 1),
    name: `Participante de teste ${index * 12 + member + 1}`,
    participantType: 'USER',
    allocated: true,
  })),
}));
const event = {
  id: eventId,
  name: 'Evento de teste visual',
  date: '2026-10-10',
  startTime: '20:00',
  endTime: '21:30',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 25,
  ownPresence: 'CONFIRMED',
  ownAllocated: true,
};
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 390, height: 500 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    for (const managing of [false, true]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.route('http://localhost:8080/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const body =
          path === '/auth/me'
            ? {
                user: {
                  id: id(999),
                  email: 'layout@example.invalid',
                  firstName: 'Layout',
                  lastName: 'Test',
                  role: 'ORGANIZER',
                },
              }
            : { event, teams };
        assert.equal(
          route.request().method(),
          'GET',
          `Unexpected mutation: ${path}`,
        );
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
          headers: {
            'Access-Control-Allow-Origin': 'http://localhost:3000',
            'Access-Control-Allow-Credentials': 'true',
          },
        });
      });
      await page.goto(
        `http://localhost:3000/org/events/${eventId}${managing ? '' : '/teams'}`,
      );
      await expect(
        page.getByRole('heading', {
          name: managing ? 'Gerenciar evento' : 'Times do evento',
          exact: true,
        }),
      ).toBeVisible();
      const main = page.locator('#events-main');
      if (managing) {
        await expect(
          main.getByRole('heading', { name: event.name }),
        ).toBeVisible();
        await expect(
          main.getByRole('button', { name: 'Finalizar', exact: true }),
        ).toBeVisible();
        await expect(
          main.getByRole('button', { name: 'Cancelar', exact: true }),
        ).toBeVisible();
        await expect(
          main.getByRole('article', { name: 'Time 1', exact: true }),
        ).toHaveCount(0);
        await expect(
          main.getByRole('region', { name: 'Times do evento', exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(
          main.getByRole('article', { name: 'Time 1', exact: true }),
        ).toBeVisible();
        await expect(
          main.getByRole('heading', { name: event.name }),
        ).toHaveCount(0);
        await expect(
          main.getByText('Total de confirmados', { exact: false }),
        ).toHaveCount(0);
        await expect(
          main.getByText('Presença vinculada à formação.', { exact: false }),
        ).toHaveCount(0);
        for (const name of [
          'Finalizar',
          'Cancelar',
          'Confirmar presença',
          'Cancelar presença',
          'Jogadores confirmados',
        ]) {
          await expect(
            main.getByRole('button', { name, exact: true }),
          ).toHaveCount(0);
        }
        await main.hover();
        await expect
          .poll(async () => {
            await page.mouse.wheel(0, 1200);
            return main.evaluate(
              (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
            );
          })
          .toBeLessThanOrEqual(2);
        await page.screenshot({
          path: fileURLToPath(
            new URL(`${viewport.width}x${viewport.height}-teams.png`, output),
          ),
        });
        await main
          .getByRole('button', { name: 'Ver jogadores', exact: true })
          .first()
          .click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(
          page
            .getByRole('dialog')
            .getByText('Participante de teste 12', { exact: true }),
        ).toBeAttached();
        await page.getByRole('button', { name: 'Fechar', exact: true }).click();
        await main
          .getByRole('button', { name: 'Editar', exact: true })
          .first()
          .click();
        await expect(
          main.getByRole('heading', { name: 'Edição de times', exact: true }),
        ).toBeVisible();
        await expect(
          main.getByRole('article', { name: 'Reservas', exact: true }),
        ).toBeAttached();
      }
      const before = await page.evaluate(() => ({
        header: document
          .querySelector('header')
          .getBoundingClientRect()
          .toJSON(),
        menu: document
          .querySelector('nav[aria-label="Menu principal"]')
          .getBoundingClientRect()
          .toJSON(),
      }));
      await main.hover();
      await expect
        .poll(async () => {
          await page.mouse.wheel(0, 1600);
          return main.evaluate(
            (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
          );
        })
        .toBeLessThanOrEqual(2);
      const layout = await page.evaluate(() => ({
        header: document
          .querySelector('header')
          .getBoundingClientRect()
          .toJSON(),
        main: document
          .querySelector('#events-main')
          .getBoundingClientRect()
          .toJSON(),
        menu: document
          .querySelector('nav[aria-label="Menu principal"]')
          .getBoundingClientRect()
          .toJSON(),
      }));
      assert.equal(layout.header.top, before.header.top);
      assert.equal(layout.menu.top, before.menu.top);
      assert.ok(
        viewport.width < 768
          ? layout.main.bottom <= layout.menu.top
          : layout.main.left >= layout.menu.right,
      );
      await expect(
        main.getByRole('link', { name: 'Voltar', exact: true }),
      ).toBeInViewport();
      const suffix = `${viewport.width}x${viewport.height}-${managing ? 'manage' : 'teams-edit'}`;
      await page.screenshot({
        path: fileURLToPath(new URL(`${suffix}.png`, output)),
      });
      if (managing) {
        await main
          .getByRole('link', { name: 'Times do evento', exact: true })
          .click();
        await expect(
          page.getByRole('heading', { name: 'Times do evento', exact: true }),
        ).toBeVisible();
        await expect(
          page
            .locator('#events-main')
            .getByRole('heading', { name: event.name }),
        ).toHaveCount(0);
      }
      console.log(
        `PASS ${suffix}: correct content; scroll reaches end; header/menu stationary${managing ? '; teams link works' : '; players modal and editing work'}`,
      );
      await context.close();
    }
  }
  for (const role of ['PLAYER', 'ADMIN']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.route('http://localhost:8080/**', async (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          new URL(route.request().url()).pathname === '/auth/me'
            ? {
                user: {
                  id: id(999),
                  email: 'layout@example.invalid',
                  firstName: 'Layout',
                  lastName: 'Test',
                  role,
                },
              }
            : { event, teams },
        ),
      }),
    );
    await page.goto(
      `http://localhost:3000/${role === 'ADMIN' ? 'org/' : ''}events/${eventId}${role === 'ADMIN' ? '/teams' : ''}`,
    );
    await expect(
      page.getByRole('article', { name: 'Time 1', exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('#events-main')
        .getByRole('button', { name: 'Editar', exact: true }),
    ).toHaveCount(role === 'PLAYER' ? 0 : 3);
    console.log(`PASS ${role}: existing team editing permission preserved`);
    await context.close();
  }
} finally {
  await browser.close();
}
