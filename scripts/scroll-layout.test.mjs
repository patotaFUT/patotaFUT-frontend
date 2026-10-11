// Browser layout regression test. API responses are intercepted test fixtures;
// no account, presence, event or database is created or modified.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = new URL('../.test-build/scroll-layout/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const user = {
  id: '507f1f77bcf86cd799439010',
  email: 'layout@example.invalid',
  firstName: 'Layout',
  lastName: 'Test',
  role: 'ORGANIZER',
};
const items = [1, 2].map((number) => ({
  id: `507f1f77bcf86cd79943901${number}`,
  name: `Evento ${number} — ${'Conteúdo longo para testar rolagem '.repeat(5)}`,
  date: '2026-10-10',
  startTime: '20:00',
  endTime: '21:30',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 11,
  ownPresence: null,
  ownAllocated: false,
}));
try {
  for (const viewport of [
    { width: 390, height: 500 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    for (const managing of [false, true]) {
      const context = await browser.newContext({ viewport, hasTouch: true });
      const page = await context.newPage();
      await page.route('http://localhost:8080/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        const body =
          path === '/auth/me'
            ? { user }
            : path === '/events'
              ? { items, nextCursor: null }
              : { error: 'Unexpected test request' };
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
      await page.goto('http://localhost:3000/events');
      await page
        .getByRole('button', { name: 'Próximo card', exact: true })
        .waitFor();
      if (managing)
        await page
          .getByRole('link', { name: 'Gerenciar', exact: true })
          .click();
      const suffix = `${viewport.width}x${viewport.height}-${managing ? 'events' : 'active'}`;
      await page
        .getByRole('button', { name: 'Próximo card', exact: true })
        .waitFor();
      await page.waitForTimeout(350);
      const before = await page.evaluate(() => {
        const main = document.querySelector('#events-main');
        const header = document.querySelector('header');
        const menu = document.querySelector('nav[aria-label="Menu principal"]');
        const shell = main.parentElement;
        return {
          main: main.getBoundingClientRect().toJSON(),
          header: header.getBoundingClientRect().toJSON(),
          menu: menu.getBoundingClientRect().toJSON(),
          height: main.clientHeight,
          scrollHeight: main.scrollHeight,
          bodyHeight: document.body.scrollHeight,
          viewport: innerHeight,
          shellClass: shell.className,
          shellStyle: {
            display: getComputedStyle(shell).display,
            height: getComputedStyle(shell).height,
            flex: getComputedStyle(shell).flex,
            rows: getComputedStyle(shell).gridTemplateRows,
          },
          bodyStyle: {
            height: getComputedStyle(document.body).height,
            overflow: getComputedStyle(document.body).overflow,
            display: getComputedStyle(document.body).display,
          },
          mainOverflow: getComputedStyle(main).overflowY,
        };
      });
      await page.screenshot({
        path: fileURLToPath(new URL(`${suffix}-top.png`, output)),
      });
      const main = page.locator('#events-main');
      await main.hover();
      await expect
        .poll(
          async () => {
            await page.mouse.wheel(0, 1000);
            return main.evaluate(
              (element) =>
                element.scrollHeight - element.clientHeight - element.scrollTop,
            );
          },
          { timeout: 5000 },
        )
        .toBeLessThanOrEqual(2);
      const after = await page.evaluate(() => {
        const main = document.querySelector('#events-main');
        const menu = document.querySelector('nav[aria-label="Menu principal"]');
        const controls = document.querySelector(
          'section[aria-roledescription="carrossel"] > div:last-child',
        );
        return {
          scrollTop: main.scrollTop,
          maxScroll: main.scrollHeight - main.clientHeight,
          main: main.getBoundingClientRect().toJSON(),
          menu: menu.getBoundingClientRect().toJSON(),
          header: document
            .querySelector('header')
            .getBoundingClientRect()
            .toJSON(),
          controls: controls.getBoundingClientRect().toJSON(),
        };
      });
      await page.screenshot({
        path: fileURLToPath(new URL(`${suffix}-bottom.png`, output)),
      });
      assert.equal(
        before.shellStyle.display,
        'grid',
        'Shell selector applies to the mounted element',
      );
      assert.equal(
        before.bodyHeight,
        viewport.height,
        'No content is stranded outside viewport',
      );
      assert.ok(before.main.height > 0, 'Main must have visible height');
      assert.ok(
        before.menu.bottom <= viewport.height + 1,
        'Menu stays in viewport',
      );
      assert.ok(
        viewport.width < 768
          ? before.main.bottom <= before.menu.top + 1
          : before.main.left >= before.menu.right,
        'Main does not overlap menu',
      );
      assert.ok(
        after.maxScroll === 0 || after.scrollTop >= after.maxScroll - 2,
        'Wheel reaches final content',
      );
      assert.equal(
        after.header.top,
        before.header.top,
        'Header remains stationary',
      );
      assert.equal(after.menu.top, before.menu.top, 'Menu remains stationary');
      assert.ok(
        after.controls.bottom <= after.main.bottom + 1,
        'Carousel controls are reachable',
      );
      await page
        .getByRole('button', { name: 'Próximo card', exact: true })
        .click();
      await page.waitForTimeout(500);
      assert.equal(
        await page
          .getByRole('button', { name: 'Mostrar card 2', exact: true })
          .getAttribute('aria-current'),
        'true',
      );
      await page
        .getByRole('button', { name: 'Card anterior', exact: true })
        .click();
      await page.waitForTimeout(500);
      assert.equal(
        await page
          .getByRole('button', { name: 'Mostrar card 1', exact: true })
          .getAttribute('aria-current'),
        'true',
      );
      if (viewport.width < 768) {
        const session = await context.newCDPSession(page);
        await main.evaluate((element) => {
          element.scrollTop = 0;
        });
        const bounds = await page.locator('article').first().boundingBox();
        const area = await main.boundingBox();
        const y = Math.min(area.y + area.height - 30, bounds.y + 80);
        const startX = bounds.x + bounds.width - 30;
        const endX = bounds.x + 30;
        async function swipe(x1, y1, x2, y2) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: x1, y: y1 }],
          });
          for (let step = 1; step <= 10; step++) {
            await session.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [
                {
                  x: x1 + ((x2 - x1) * step) / 10,
                  y: y1 + ((y2 - y1) * step) / 10,
                },
              ],
            });
            await page.waitForTimeout(20);
          }
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          });
          await page.waitForTimeout(500);
        }
        await swipe(startX, y, endX, y);
        assert.equal(
          await page
            .getByRole('button', { name: 'Mostrar card 2', exact: true })
            .getAttribute('aria-current'),
          'true',
          'Horizontal touch changes event',
        );
        await swipe(endX, y, startX, y);
        assert.equal(
          await page
            .getByRole('button', { name: 'Mostrar card 1', exact: true })
            .getAttribute('aria-current'),
          'true',
          'Reverse horizontal touch changes event',
        );
        await swipe((startX + endX) / 2, y, (startX + endX) / 2, area.y + 15);
        assert.ok(
          await main.evaluate((element) => element.scrollTop > 0),
          'Vertical touch on card scrolls main',
        );
        await session.detach();
      }
      console.log(
        `PASS ${suffix}: main=${before.height}px, vertical=${after.scrollTop}/${after.maxScroll}px; fixed header/menu; arrows${viewport.width < 768 ? '; horizontal and vertical touch' : ''}`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
