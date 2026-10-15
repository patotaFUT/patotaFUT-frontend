import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apiOrigin, forwardApi, proxyCookie } from '../src/lib/http/api-proxy';
import { publicConfig } from '../src/config/public';
import { proxyTimeout } from '../src/features/auth/access-timing';

test('Access wake-up budget is limited to session endpoints, not events or form submissions', () => {
  for (const endpoint of ['me', 'csrf', 'refresh'])
    assert.equal(proxyTimeout(['auth', endpoint]), 60_000);
  for (const segments of [
    ['events'],
    ['events', 'formation'],
    ['auth', 'login'],
    ['auth', 'recovery', 'reset'],
  ])
    assert.equal(proxyTimeout(segments), 15_000);
});

const backend = 'https://api.example.invalid';
const frontend = 'https://patota.example.invalid';
const csrf = 'a'.repeat(64) + '.' + 'b'.repeat(64);

test('Server configuration: fixed origin, HTTPS outside loopback, no credentials or API prefix', () => {
  assert.equal(publicConfig.apiUrl, '/api');
  assert.equal(apiOrigin(backend).origin, backend);
  assert.equal(
    apiOrigin('http://localhost:8080').origin,
    'http://localhost:8080',
  );
  for (const value of [
    undefined,
    '',
    'http://api.example.invalid',
    'ftp://api.example.invalid',
    backend + '/api',
    backend + '?target=elsewhere',
    backend + '#fragment',
    'https://user:secret@api.example.invalid',
    ' ' + backend,
  ])
    assert.throws(() => apiOrigin(value));
});

test('Cookies: preserve separate fields, expiry, Secure/HttpOnly/Lax; map creation and deletion scopes', async () => {
  const expires = 'Wed, 21 Oct 2026 07:28:00 GMT';
  const cookies = [
    `patotafut_access=access; Domain=api.example.invalid; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900`,
    `patotafut_refresh=refresh; Path=/auth; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`,
    `patotafut_recovery=grant; Path=/auth/recovery; HttpOnly; Secure; SameSite=Lax`,
  ];
  const headers = new Headers({ 'Cache-Control': 'public, max-age=3600' });
  cookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
  const response = await forwardApi(
    new Request(frontend + '/api/auth/login'),
    ['auth', 'login'],
    backend,
    async () => new Response('{}', { headers }),
  );
  const received = response.headers.getSetCookie();
  assert.equal(received.length, 3);
  assert.match(
    received[0] ?? '',
    /Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=900/,
  );
  assert.match(received[1] ?? '', /Path=\/api\/auth; Expires=Wed, 21 Oct 2026/);
  assert.match(received[2] ?? '', /Path=\/api\/auth\/recovery/);
  assert.ok(received.every((cookie) => !/domain=/i.test(cookie)));
  assert.equal(
    proxyCookie(
      'patotafut_refresh=; Path=/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly',
    ),
    'patotafut_refresh=; Path=/api/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly',
  );
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
});

test('Transport: preserve method, repeated query, raw body, Cookie, Origin and CSRF without trusting proxy headers', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const body = '{ "revision": 7, "name": "Convidado" }';
    const request = new Request(
      frontend +
        '/api/events/id?name=a%20b&x=1&x=2&target=https://evil.invalid',
      {
        method,
        body,
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'patotafut_access=fixture',
          Origin: frontend,
          'X-CSRF-Token': csrf,
          'X-Forwarded-For': 'spoofed',
          'X-Forwarded-Host': 'evil.invalid',
        },
      },
    );
    const response = await forwardApi(
      request,
      ['events', 'id'],
      backend,
      async (url, init) => {
        assert.equal(
          String(url),
          backend + '/events/id?name=a%20b&x=1&x=2&target=https://evil.invalid',
        );
        assert.equal(init?.method, method);
        assert.equal(init?.cache, 'no-store');
        assert.equal(init?.redirect, 'manual');
        const forwarded = new Headers(init?.headers);
        assert.equal(forwarded.get('origin'), frontend);
        assert.equal(forwarded.get('cookie'), 'patotafut_access=fixture');
        assert.equal(forwarded.get('x-csrf-token'), csrf);
        assert.equal(forwarded.get('x-forwarded-for'), null);
        assert.equal(forwarded.get('x-forwarded-host'), null);
        assert.equal(await new Response(init?.body).text(), body);
        return Response.json(
          { error: 'Conflito', code: 'EVENT_CONFLICT' },
          { status: 409 },
        );
      },
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: 'Conflito',
      code: 'EVENT_CONFLICT',
    });
  }
});

test('Origin remains absent or untrusted for backend rejection; no forged trusted Origin', async () => {
  for (const origin of [undefined, 'https://untrusted.example.invalid']) {
    const headers = new Headers();
    if (origin) headers.set('origin', origin);
    await forwardApi(
      new Request(frontend + '/api/auth/login', { headers }),
      ['auth', 'login'],
      backend,
      async (_url, init) => {
        assert.equal(new Headers(init?.headers).get('origin'), origin ?? null);
        return new Response(null, { status: 403 });
      },
    );
  }
});

test('Errors, redirects, HEAD and 204: safe responses, no external forwarding and no cached private results', async () => {
  let calls = 0;
  const transport: typeof fetch = async () => {
    calls++;
    return new Response(null, { status: 204 });
  };
  for (const segments of [
    ['api', 'events'],
    ['auth', '..'],
    ['auth', '%2F%2Fevil'],
    ['https:', 'evil'],
    ['events', 'a/b'],
  ]) {
    assert.equal(
      (
        await forwardApi(
          new Request(frontend + '/api/test'),
          segments,
          backend,
          transport,
        )
      ).status,
      404,
    );
  }
  assert.equal(calls, 0);
  const missing = await forwardApi(
    new Request(frontend + '/api/auth/me'),
    ['auth', 'me'],
    undefined,
    transport,
  );
  assert.equal(missing.status, 503);
  const failure = await forwardApi(
    new Request(frontend + '/api/auth/me'),
    ['auth', 'me'],
    backend,
    async () => {
      throw new Error('private upstream host/token details');
    },
  );
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /private upstream|token details/);
  const timeout = await forwardApi(
    new Request(frontend + '/api/auth/me'),
    ['auth', 'me'],
    backend,
    async () => {
      throw new DOMException('private detail', 'TimeoutError');
    },
  );
  assert.equal(timeout.status, 504);
  const external = await forwardApi(
    new Request(frontend + '/api/auth/me'),
    ['auth', 'me'],
    backend,
    async () =>
      new Response(null, {
        status: 302,
        headers: { Location: 'https://evil.invalid' },
      }),
  );
  assert.equal(external.status, 502);
  const internal = await forwardApi(
    new Request(frontend + '/api/auth/me'),
    ['auth', 'me'],
    backend,
    async () =>
      new Response(null, {
        status: 307,
        headers: { Location: '/auth/login?next=events' },
      }),
  );
  assert.equal(internal.headers.get('location'), '/api/auth/login?next=events');
  const logout = await forwardApi(
    new Request(frontend + '/api/auth/logout', { method: 'POST' }),
    ['auth', 'logout'],
    backend,
    transport,
  );
  assert.equal(logout.status, 204);
  assert.equal(await logout.text(), '');
  const head = await forwardApi(
    new Request(frontend + '/api/events', { method: 'HEAD' }),
    ['events'],
    backend,
    async () =>
      new Response('body', {
        headers: {
          'Content-Encoding': 'gzip',
          'Content-Length': '99',
          Connection: 'x-internal',
          'X-Internal': 'remove',
        },
      }),
  );
  assert.equal(await head.text(), '');
  for (const header of [
    'content-encoding',
    'content-length',
    'connection',
    'x-internal',
  ])
    assert.equal(head.headers.get(header), null);
});
