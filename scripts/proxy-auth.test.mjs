// Real Chromium -> production Next Route Handler -> real Express auth/events.
// Persistence is an explicit in-memory double. Never connects to MongoDB.
// Requires npm run build in both repositories. Uses a separate port, not the dev server.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import express from '../../patotaFUT-API/node_modules/express/index.js';
import { User, AuthSession } from '../../patotaFUT-API/dist/models/index.js';
import { hashPassword } from '../../patotaFUT-API/dist/security/password.js';
import { createAuthRoutes } from '../../patotaFUT-API/dist/routes/auth.routes.js';
import { createEventRoutes } from '../../patotaFUT-API/dist/routes/event.routes.js';
import { eventRepository } from '../../patotaFUT-API/dist/repositories/event.repository.js';
import {
  EventService,
  eventService,
} from '../../patotaFUT-API/dist/services/event.service.js';
import { AuthError } from '../../patotaFUT-API/dist/services/auth.service.js';
import { EventError } from '../../patotaFUT-API/dist/services/event-error.js';
import { eventFixture } from '../../patotaFUT-API/scripts/helpers/event-store-double.mjs';

const frontend = 'http://localhost:3100';
const password = 'Proxy-test-password-2026';
const output = new URL('../.test-build/proxy-auth/', import.meta.url);
await mkdir(output, { recursive: true });
const fixture = eventFixture();
fixture.organizer.email = 'proxy-organizer@example.invalid';
fixture.organizer.passwordHash = await hashPassword(password);
const users = new Map([[fixture.organizer._id.toString(), fixture.organizer]]);
const sessions = new Map();
const restores = [];
const query = (read) => ({
  lean() {
    return this;
  },
  exec: async () => read(),
});
function replace(object, key, implementation) {
  const original = object[key];
  restores.push(() => {
    object[key] = original;
  });
  object[key] = implementation;
}
replace(User, 'findById', (id) =>
  query(() => users.get(id.toString()) ?? null),
);
replace(User, 'findOne', (filter) =>
  query(
    () =>
      [...users.values()].find((user) =>
        Object.entries(filter).every(([key, value]) => user[key] === value),
      ) ?? null,
  ),
);
replace(AuthSession, 'create', async (input) => {
  const doc = new AuthSession(input);
  await doc.validate();
  sessions.set(doc._id.toString(), doc.toObject());
  return doc;
});
replace(AuthSession, 'findOne', (filter) =>
  query(() => {
    const session = sessions.get(filter._id.toString());
    return session?.userId.equals(filter.userId) ? session : null;
  }),
);
replace(AuthSession, 'findOneAndUpdate', (filter, update) =>
  query(() => {
    const session = sessions.get(filter._id.toString());
    if (
      !session ||
      !session.userId.equals(filter.userId) ||
      session.revokedAt !== null ||
      session.refreshTokenHash !== filter.refreshTokenHash ||
      session.expiresAt <= filter.expiresAt.$gt
    )
      return null;
    Object.assign(session, update.$set);
    return { ...session };
  }),
);
replace(AuthSession, 'updateOne', (filter, update) =>
  query(() => {
    const session = sessions.get(filter._id.toString());
    if (session?.userId.equals(filter.userId) && session.revokedAt === null)
      Object.assign(session, update.$set);
    return { acknowledged: true };
  }),
);
replace(eventRepository, 'transaction', fixture.repository.transaction);
const service = new EventService(fixture.repository);
const detail = await service.create(fixture.organizer._id.toString(), {
  name: 'Evento de teste do proxy',
  date: '2026-10-12',
  startTime: '19:00',
  endTime: '21:00',
});
assert.ok(eventService);
const config = {
  secrets: {
    access: 'test-access-only-'.repeat(4),
    refresh: 'test-refresh-only-'.repeat(4),
  },
  csrfSecret: 'test-csrf-only-'.repeat(4),
  secure: false,
  sameSite: 'lax',
  origins: [frontend],
  googleClientId: undefined,
};
const observations = [];
const app = express();
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  observations.push({
    path: req.path,
    method: req.method,
    origin: req.get('origin'),
    hasRefresh: (req.headers.cookie ?? '').includes('patotafut_refresh='),
    hasCsrf: Boolean(req.get('x-csrf-token')),
  });
  next();
});
app.use('/auth', createAuthRoutes(config));
app.use('/events', createEventRoutes(config));
app.use((error, _req, res, _next) => {
  const expected = error instanceof AuthError || error instanceof EventError;
  res
    .status(expected ? error.status : 500)
    .json({ error: expected ? error.message : 'Falha no teste.' });
});
const apiServer = app.listen(0, '127.0.0.1');
await once(apiServer, 'listening');
const address = apiServer.address();
if (typeof address !== 'object' || address === null)
  throw Error('Fixture address unavailable');
const apiUrl = `http://127.0.0.1:${address.port}`;
const next = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--port',
    '3100',
    '--hostname',
    '127.0.0.1',
  ],
  {
    cwd: process.cwd(),
    windowsHide: true,
    env: { ...process.env, API_URL: apiUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let startup = '';
next.stdout.on('data', (data) => {
  startup = (startup + data.toString()).slice(-8000);
});
next.stderr.on('data', (data) => {
  startup = (startup + data.toString()).slice(-8000);
});
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (next.exitCode !== null)
      throw Error(`Next test server exited: ${startup}`);
    try {
      const ready = await fetch(frontend + '/api/auth/me');
      if (ready.status === 401) break;
    } catch {
      /* Wait for the isolated Next server only. */
    }
    if (attempt === 59) throw Error('Next test server did not become ready');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const apiRequests = [];
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (
        url.pathname.startsWith('/api/') ||
        url.origin === apiUrl ||
        (request.resourceType() === 'xhr' &&
          /\/(auth|events)(\/|$)/.test(url.pathname))
      )
        apiRequests.push(url);
    });
    await page.goto(frontend);
    await expect(page.locator('#email')).toBeEnabled();
    await page.locator('#email').fill(fixture.organizer.email);
    await page.locator('#password').fill(password);
    const loginResponse = page.waitForResponse(
      (response) => response.url() === frontend + '/api/auth/login',
    );
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const login = await loginResponse;
    assert.equal(login.status(), 200);
    assert.equal(
      (await login.headersArray()).filter(
        (header) => header.name.toLowerCase() === 'set-cookie',
      ).length,
      2,
    );
    await expect(page).toHaveURL(frontend + '/events');
    await expect(
      page.getByText('Evento de teste do proxy', { exact: true }),
    ).toBeVisible();
    const cookies = await context.cookies();
    assert.equal(
      cookies.find((cookie) => cookie.name === 'patotafut_refresh')?.path,
      '/api/auth',
    );
    assert.equal(
      cookies.find((cookie) => cookie.name === 'patotafut_access')?.path,
      '/',
    );
    assert.ok(
      cookies
        .filter((cookie) => cookie.name.startsWith('patotafut_'))
        .every(
          (cookie) =>
            cookie.httpOnly &&
            cookie.sameSite === 'Lax' &&
            cookie.domain === 'localhost',
        ),
    );
    await page.reload();
    await expect(
      page.getByText('Evento de teste do proxy', { exact: true }),
    ).toBeVisible();
    const oldRefresh = (await context.cookies()).find(
      (cookie) => cookie.name === 'patotafut_refresh',
    )?.value;
    await context.clearCookies({ name: 'patotafut_access' });
    const renewedResponse = page.waitForResponse(
      (response) => response.url() === frontend + '/api/auth/refresh',
    );
    await page.reload();
    const renewed = await renewedResponse;
    assert.equal(renewed.status(), 200);
    await expect(
      page.getByText('Evento de teste do proxy', { exact: true }),
    ).toBeVisible();
    assert.notEqual(
      (await context.cookies()).find(
        (cookie) => cookie.name === 'patotafut_refresh',
      )?.value,
      oldRefresh,
    );
    // Real backend rejects untrusted Origin and wrong CSRF through the proxy.
    const csrfResponse = await context.request.get(frontend + '/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();
    const rejectedOrigin = await context.request.post(
      frontend + '/api/auth/logout',
      {
        data: {},
        headers: {
          Origin: 'https://untrusted.invalid',
          'X-CSRF-Token': csrfToken,
        },
      },
    );
    assert.equal(rejectedOrigin.status(), 403);
    const rejectedCsrf = await context.request.post(
      frontend + '/api/auth/logout',
      { data: {}, headers: { Origin: frontend, 'X-CSRF-Token': 'invalid' } },
    );
    assert.equal(rejectedCsrf.status(), 403);
    // Query is forwarded and private event reads cannot be cached.
    const events = await context.request.get(
      frontend + '/api/events?limit=8&search=proxy',
    );
    assert.equal(events.status(), 200);
    assert.equal((await events.json()).items[0].id, detail.event.id);
    assert.match(events.headers()['cache-control'], /no-store/);
    await page.screenshot({
      path: fileURLToPath(
        new URL(`${viewport.width}-authenticated.png`, output),
      ),
    });
    const logoutResponse = page.waitForResponse(
      (response) => response.url() === frontend + '/api/auth/logout',
    );
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    const logout = await logoutResponse;
    assert.equal(logout.status(), 204);
    assert.equal(
      (await logout.headersArray()).filter(
        (header) => header.name.toLowerCase() === 'set-cookie',
      ).length,
      3,
    );
    await expect(page).toHaveURL(frontend + '/');
    assert.equal(
      (await context.cookies()).filter((cookie) =>
        ['patotafut_access', 'patotafut_refresh'].includes(cookie.name),
      ).length,
      0,
    );
    assert.equal(
      (await context.request.get(frontend + '/api/auth/me')).status(),
      401,
    );
    await expect(page.locator('#email')).toBeEnabled();
    await page.locator('#email').fill(fixture.organizer.email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(frontend + '/events');
    // Expire the test sessions in memory, then verify rejected refresh removes its cookie.
    for (const session of sessions.values()) session.expiresAt = new Date(0);
    await context.clearCookies({ name: 'patotafut_access' });
    const expiredResponse = page.waitForResponse(
      (response) => response.url() === frontend + '/api/auth/refresh',
    );
    await page.reload();
    assert.equal((await expiredResponse).status(), 401);
    await expect(page).toHaveURL(frontend + '/');
    assert.equal(
      (await context.cookies()).some(
        (cookie) => cookie.name === 'patotafut_refresh',
      ),
      false,
    );
    assert.ok(
      apiRequests.length > 0 &&
        apiRequests.every(
          (url) => url.origin === frontend && url.pathname.startsWith('/api/'),
        ),
    );
    assert.deepEqual(browserErrors, []);
    console.log(
      `PASS ${viewport.width}x${viewport.height}: real Next/Express proxy, login, reload, refresh rotation, logout, expired session, CSRF/Origin rejection and same-origin API requests`,
    );
    await context.close();
  }
  assert.ok(
    observations.some(
      (item) =>
        item.path === '/auth/refresh' &&
        item.hasRefresh &&
        item.hasCsrf &&
        item.origin === frontend,
    ),
  );
  assert.ok(
    observations
      .filter((item) => item.path.startsWith('/events'))
      .every((item) => !item.hasRefresh),
  );
} finally {
  await browser?.close();
  next.kill();
  apiServer.closeAllConnections();
  await new Promise((resolve) => apiServer.close(resolve));
  restores.reverse().forEach((restore) => restore());
}
