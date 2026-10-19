// Local public pages only; never uses real accounts, tokens, production APIs or email.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const base = new URL(
  process.env.LEGAL_TEST_BASE_URL ?? 'http://127.0.0.1:3106',
);
if (!['127.0.0.1', 'localhost'].includes(base.hostname))
  throw new Error('Use only a local test server.');
const output = new URL('../.test-build/legal/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const failures = [],
      requests = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.route('**/api/**', async (route) => {
      requests.push(new URL(route.request().url()).pathname);
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Fixture unauthenticated' }),
      });
    });
    for (const [path, title] of [
      ['/privacidade', 'Política de Privacidade'],
      ['/termos', 'Termos de Uso'],
    ]) {
      requests.length = 0;
      const response = await page.goto(new URL(path, base).href);
      assert.equal(response.status(), 200);
      await expect(
        page.getByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      assert.equal(new URL(page.url()).pathname, path);
      assert.deepEqual(requests, []);
      const main = page.getByRole('main');
      await main.focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('link', { name: 'Voltar ao início' }),
      ).toBeFocused();
      await main.focus();
      await page.keyboard.press('End');
      await expect
        .poll(() => main.evaluate((node) => node.scrollTop))
        .toBeGreaterThan(0);
      await page.getByRole('link', { name: 'Voltar ao título' }).click();
      await expect(
        page.getByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        body: document.body.scrollHeight,
        height: innerHeight,
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        mainWidth: document.querySelector('main').scrollWidth,
      }));
      assert.ok(dimensions.body <= dimensions.height + 1);
      assert.ok(dimensions.width <= dimensions.viewport + 1);
      assert.ok(dimensions.mainWidth <= dimensions.viewport + 1);
      await page.screenshot({
        path: fileURLToPath(
          new URL(`${path.slice(1)}-${viewport.width}.png`, output),
        ),
      });
    }
    await page.goto(base.href);
    await page.getByRole('link', { name: 'Política de Privacidade' }).click();
    await expect(page).toHaveURL(new URL('/privacidade', base).href);
    await page
      .getByRole('navigation', { name: 'Documentos do PatotaFUT' })
      .getByRole('link', { name: 'Termos de Uso' })
      .click();
    await expect(page).toHaveURL(new URL('/termos', base).href);
    assert.deepEqual(failures, []);
    console.log(
      `PASS public legal pages, login links, keyboard, internal scroll, no horizontal overflow: ${viewport.width}x${viewport.height}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
