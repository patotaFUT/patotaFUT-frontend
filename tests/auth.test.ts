import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import {
  AuthClient,
  AuthRequestError,
} from '../src/features/auth/auth.service';
import {
  parseAuthResponse,
  parseCsrfResponse,
  isRecord,
} from '../src/features/auth/auth.contracts';
import {
  validateLogin,
  validateRegister,
  toRegisterRequest,
} from '../src/features/auth/auth.validation';
import type {
  AuthCoordinator,
  SessionNotice,
} from '../src/features/auth/auth-coordinator';
import { authContent } from '../src/features/auth/auth.content';
import { recoveryContent } from '../src/features/auth/auth.content';
import {
  accessRequestTimeout,
  accessRestoreTimeout,
} from '../src/features/auth/access-timing';
import {
  validateRecoveryEmail,
  validateReset,
} from '../src/features/auth/auth.validation';
import {
  parseRecoveryChallenge,
  parseRecoveryVerified,
  parseRecoveryComplete,
} from '../src/features/auth/recovery.contracts';

const user = {
  id: '0123456789abcdef01234567',
  email: 'player@example.com',
  firstName: 'Player',
  lastName: 'Test',
  role: 'PLAYER',
};

test('RN07/RN57: role change notifies other sessions and /me restores the new role without replacing credentials; conflicts never replay', async () => {
  let role = 'PLAYER',
    status = 200;
  const calls: string[] = [],
    notices: SessionNotice[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const path = config.url ?? '';
    calls.push(path);
    if (path === '/auth/csrf')
      return {
        status: 200,
        statusText: '',
        headers: {},
        config,
        data: { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` },
      };
    if (path.endsWith('/role')) {
      if (status === 200) role = 'ADMIN';
      return {
        status,
        statusText: '',
        headers: {},
        config,
        data: {
          member: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            role,
          },
        },
      };
    }
    return {
      status: 200,
      statusText: '',
      headers: {},
      config,
      data: { user: { ...user, role } },
    };
  };
  const client = new AuthClient(
    axios.create({ adapter }),
    {
      exclusive: (action) => action(),
      notify: (notice) => notices.push(notice),
      subscribe: () => () => undefined,
    },
    '/api',
  );
  await client.protectedRequest(`/account/members/${user.id}/role`, {
    confirmed: true,
    role: 'ADMIN',
    expectedRole: 'PLAYER',
  });
  assert.deepEqual(notices, ['session-changed']);
  const restored = await client.restore(false);
  assert.equal(restored.status, 'authenticated');
  if (restored.status === 'authenticated')
    assert.equal(restored.user.role, 'ADMIN');
  status = 409;
  const before = calls.length;
  await client.protectedRequest(`/account/members/${user.id}/role`, {
    confirmed: true,
    role: 'ORGANIZER',
    expectedRole: 'PLAYER',
  });
  assert.deepEqual(calls.slice(before), [
    '/auth/csrf',
    `/account/members/${user.id}/role`,
  ]);
  assert.deepEqual(notices, ['session-changed']);
});

test('Access: slow wake-up succeeds after 20s; ordinary operations retain their local timeout', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const calls: { path: string | undefined; timeout: number | undefined }[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push({ path: config.url, timeout: config.timeout });
    if (config.url === '/auth/me')
      await new Promise<void>((resolve) => setTimeout(resolve, 20_000));
    const data =
      config.url === '/auth/csrf'
        ? { csrfToken: `${'a'.repeat(64)}.${'b'.repeat(64)}` }
        : { user };
    return { status: 200, statusText: '', data, headers: {}, config };
  };
  const auth = new AuthClient(
    axios.create({ adapter, timeout: 15_000 }),
    {
      exclusive: (operation) => operation(),
      notify() {},
      subscribe: () => () => undefined,
    },
    '/api',
  );
  const pending = auth.restore();
  assert.equal(auth.restore(), pending);
  context.mock.timers.tick(20_000);
  assert.equal((await pending).status, 'authenticated');
  await auth.login({ email: user.email, password: 'fixture' });
  assert.deepEqual(calls, [
    { path: '/auth/me', timeout: accessRequestTimeout },
    { path: '/auth/csrf', timeout: 15_000 },
    { path: '/auth/login', timeout: 15_000 },
  ]);
});

test('Access: total deadline cancels lock wait; retry is explicit and deduplicated', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let waits = 0;
  let blocked = true;
  const coordinator: AuthCoordinator = {
    exclusive<T>(
      operation: () => Promise<T>,
      signal?: AbortSignal,
    ): Promise<T> {
      waits++;
      if (!blocked) return operation();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('timeout')), {
          once: true,
        });
      });
    },
    notify() {},
    subscribe: () => () => undefined,
  };
  const adapter: AxiosAdapter = async (config) => {
    assert.equal(config.timeout, accessRequestTimeout);
    assert.ok(config.signal);
    return { status: 200, statusText: '', data: { user }, headers: {}, config };
  };
  const auth = new AuthClient(axios.create({ adapter }), coordinator, '/api');
  const pending = auth.restore();
  assert.equal(auth.restore(), pending);
  context.mock.timers.tick(accessRestoreTimeout);
  const result = await pending;
  assert.equal(result.status, 'error');
  if (result.status === 'error')
    assert.equal(result.error.kind, 'communication');
  assert.equal(waits, 1);
  blocked = false;
  assert.equal((await auth.restore()).status, 'authenticated');
  assert.equal(waits, 2);
});

test('Access: deadline aborts in-flight request without replay; next restore can succeed', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const adapter: AxiosAdapter = async (config) => {
    calls++;
    if (calls === 1)
      await new Promise<void>((_resolve, reject) => {
        config.signal?.addEventListener?.('abort', () =>
          reject(new Error('aborted')),
        );
      });
    return { status: 200, statusText: '', data: { user }, headers: {}, config };
  };
  const auth = new AuthClient(
    axios.create({ adapter }),
    {
      exclusive: (operation) => operation(),
      notify() {},
      subscribe: () => () => undefined,
    },
    '/api',
  );
  const pending = auth.restore();
  assert.equal(calls, 1);
  context.mock.timers.tick(accessRestoreTimeout);
  assert.equal((await pending).status, 'error');
  assert.equal(calls, 1);
  assert.equal((await auth.restore()).status, 'authenticated');
  assert.equal(calls, 2);
});

function recoveryFixture() {
  let tail: Promise<void> = Promise.resolve();
  const requests: {
    path: string;
    body: unknown;
    csrf: unknown;
    credentials: boolean | undefined;
  }[] = [];
  const notices: SessionNotice[] = [];
  const state = {
    token: '',
    generation: 0,
    status: 200,
    code: '',
    network: false,
    malformed: false,
  };
  const coordinator: AuthCoordinator = {
    exclusive<T>(operation: () => Promise<T>): Promise<T> {
      const task = tail.then(operation);
      tail = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    notify(notice): void {
      notices.push(notice);
    },
    subscribe() {
      return () => undefined;
    },
  };
  const adapter: AxiosAdapter = async (
    config: InternalAxiosRequestConfig<unknown>,
  ) => {
    if (state.network) throw new Error('Raw sensitive transport detail');
    const path = config.url ?? '';
    const raw: unknown = config.data;
    const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const csrf: unknown = config.headers.get('X-CSRF-Token');
    requests.push({ path, body, csrf, credentials: config.withCredentials });
    let status = state.status;
    let data: unknown;
    if (path === '/auth/csrf') {
      status = 200;
      state.token =
        (++state.generation).toString(16).padStart(64, '0') +
        '.' +
        'b'.repeat(64);
      data = { csrfToken: state.token };
    } else if (
      csrf !== state.token ||
      config.headers.get('Content-Type') !== 'application/json'
    ) {
      status = 403;
      data = { error: 'Invalid CSRF' };
    } else if (state.status !== 200)
      data = { error: 'Private backend detail', code: state.code };
    else if (path.endsWith('/request') || path.endsWith('/resend')) {
      status = 202;
      data = {
        message: recoveryContent.generic,
        challengeId: 'a'.repeat(64),
        expiresIn: 600,
        resendAfter: 60,
      };
    } else if (path.endsWith('/verify'))
      data = { message: 'Código validado.', expiresIn: 300 };
    else data = { message: 'Senha alterada.' };
    if (state.malformed && path !== '/auth/csrf')
      data = { ...user, grant: 'must-not-be-accepted' };
    return { data, status, statusText: '', headers: {}, config };
  };
  const http = axios.create({
    adapter,
    withCredentials: true,
    validateStatus: () => true,
  });
  return {
    auth: new AuthClient(http, coordinator, '/api'),
    requests,
    notices,
    state,
  };
}

test('Recovery form: API password limits, exact confirmation and leading zeros', () => {
  assert.equal(validateRecoveryEmail('invalid'), authContent.emailInvalid);
  assert.equal(validateRecoveryEmail('controlled@example.com'), undefined);
  assert.equal(
    validateReset({ password: 'short', confirmPassword: 'short' }).password,
    authContent.passwordTooShort,
  );
  assert.equal(
    validateReset({
      password: 'x'.repeat(1025),
      confirmPassword: 'x'.repeat(1025),
    }).password,
    authContent.passwordTooLong,
  );
  const password = ' senha-com-espacos ';
  assert.deepEqual(validateReset({ password, confirmPassword: password }), {});
  assert.equal(
    validateReset({ password, confirmPassword: password.trim() })
      .confirmPassword,
    authContent.confirmationMismatch,
  );
});

test('Recovery boundaries: runtime validates responses and rejects authorization/code exposure', () => {
  const response = {
    message: recoveryContent.generic,
    challengeId: 'a'.repeat(64),
    expiresIn: 600,
    resendAfter: 60,
  };
  assert.deepEqual(parseRecoveryChallenge(response), response);
  for (const bad of [
    null,
    { ...response, code: '00001234' },
    { ...response, challengeId: 'email@example.com' },
    { ...response, expiresIn: 0 },
  ])
    assert.throws(() => parseRecoveryChallenge(bad));
  assert.throws(() =>
    parseRecoveryVerified({ message: 'ok', expiresIn: 300, grant: 'private' }),
  );
  assert.throws(() => parseRecoveryComplete({ message: 'ok', user }));
});

test('Recovery client: exact payloads, fresh coordinated CSRF, cookies and no second login', async () => {
  const f = recoveryFixture();
  const challenge = await f.auth.requestRecovery('controlled@example.com');
  await f.auth.verifyRecovery({
    challengeId: challenge.challengeId,
    code: '00001234',
  });
  await f.auth.resetPassword({ password: ' senha-nova-teste ' });
  const posts = f.requests.filter((request) => request.path !== '/auth/csrf');
  assert.deepEqual(
    posts.map((request) => request.body),
    [
      { email: 'controlled@example.com' },
      { challengeId: challenge.challengeId, code: '00001234' },
      { password: ' senha-nova-teste ' },
    ],
  );
  assert.ok(posts.every((request) => request.credentials === true));
  assert.equal(new Set(posts.map((request) => request.csrf)).size, 3);
  assert.deepEqual(f.notices, ['session-ended']);
  assert.ok(
    !f.requests.some((request) => /\/login$|\/refresh$/.test(request.path)),
  );
});

test('Recovery client: concurrent resend/verify share CSRF lock and do not expose cookies', async () => {
  const f = recoveryFixture();
  await Promise.all([
    f.auth.requestRecovery('controlled@example.com', true),
    f.auth.verifyRecovery({ challengeId: 'a'.repeat(64), code: '00001234' }),
  ]);
  assert.deepEqual(
    f.requests.map((request) => request.path),
    [
      '/auth/csrf',
      '/auth/recovery/resend',
      '/auth/csrf',
      '/auth/recovery/verify',
    ],
  );
  assert.deepEqual(f.notices, []);
});

test('Recovery client: invalid/expired/limited/CSRF/unavailable errors never refresh or retry', async () => {
  for (const [status, code, expected] of [
    [400, 'RECOVERY_CODE_INVALID', recoveryContent.codeRejected],
    [
      401,
      'RECOVERY_AUTHORIZATION_INVALID',
      recoveryContent.authorizationInvalid,
    ],
    [403, '', authContent.csrfRejected],
    [429, 'RECOVERY_LIMIT', recoveryContent.limited],
    [503, 'RECOVERY_UNAVAILABLE', recoveryContent.unavailable],
  ] satisfies [number, string, string][]) {
    const f = recoveryFixture();
    f.state.status = status;
    f.state.code = code;
    await assert.rejects(
      f.auth.resetPassword({ password: 'senha-nova-teste' }),
      (error: unknown) =>
        error instanceof AuthRequestError && error.failure.message === expected,
    );
    assert.equal(f.requests.length, 2);
    assert.deepEqual(f.notices, []);
  }
});

test('Recovery client: uncertain network result and malformed success never manufacture success', async () => {
  const f = recoveryFixture();
  f.state.network = true;
  await assert.rejects(
    f.auth.resetPassword({ password: 'senha-nova-teste' }),
    (error: unknown) =>
      error instanceof AuthRequestError &&
      error.failure.message === recoveryContent.uncertain,
  );
  f.state.network = false;
  f.state.status = 500;
  await assert.rejects(
    f.auth.resetPassword({ password: 'senha-nova-teste' }),
    (error: unknown) =>
      error instanceof AuthRequestError &&
      error.failure.message === recoveryContent.uncertain,
  );
  f.state.status = 200;
  f.state.malformed = true;
  await assert.rejects(
    f.auth.resetPassword({ password: 'senha-nova-teste' }),
    (error: unknown) =>
      error instanceof AuthRequestError && error.failure.kind === 'protocol',
  );
  assert.deepEqual(f.notices, []);
});

function fixture() {
  let tail: Promise<void> = Promise.resolve();
  const requests: {
    path: string;
    method: string;
    body: unknown;
    csrf: unknown;
    credentials: boolean | undefined;
  }[] = [];
  const notices: SessionNotice[] = [];
  const state = {
    access: false,
    refresh: true,
    csrf: '',
    csrfRequests: 0,
    rotations: 0,
    loginStatus: 200,
    registerStatus: 201,
    googleStatus: 200,
    googleCode: '',
    meStatus: 200,
    network: false,
    malformed: false,
    logoutStatus: 204,
  };
  const adapter: AxiosAdapter = async (
    config: InternalAxiosRequestConfig<unknown>,
  ) => {
    if (state.network)
      throw new Error('Sensitive transport detail must not reach UI');
    const path = config.url ?? '';
    const method = config.method ?? '';
    const raw: unknown = config.data;
    const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const csrf: unknown = config.headers.get('X-CSRF-Token');
    requests.push({
      path,
      method,
      body,
      csrf,
      credentials: config.withCredentials,
    });
    let status = 200;
    let data: unknown = { user };
    if (path === '/auth/csrf') {
      state.csrf =
        (++state.csrfRequests).toString(16).padStart(64, '0') +
        '.' +
        'b'.repeat(64);
      data = { csrfToken: state.csrf };
    } else if (
      method === 'post' &&
      (csrf !== state.csrf ||
        config.headers.get('Content-Type') !== 'application/json')
    ) {
      status = 403;
      data = { error: 'Requisição não autorizada.' };
    } else if (path === '/auth/register') {
      status = state.registerStatus;
      if (status === 201) {
        state.access = true;
        state.refresh = true;
      } else data = { error: 'Não foi possível cadastrar essa conta.' };
    } else if (path === '/auth/login') {
      status = state.loginStatus;
      if (status === 200) {
        state.access = true;
        state.refresh = true;
      } else data = { error: 'Credenciais inválidas.' };
    } else if (path === '/auth/google') {
      status = state.googleStatus;
      if (status === 200) {
        state.access = true;
        state.refresh = true;
      } else
        data = { error: 'Identidade Google inválida.', code: state.googleCode };
    } else if (path === '/auth/me') {
      status = state.access ? state.meStatus : 401;
      if (status !== 200) data = { error: 'Autenticação necessária.' };
    } else if (path === '/auth/refresh') {
      state.rotations++;
      if (state.refresh) state.access = true;
      else {
        status = 401;
        state.csrf = '';
        data = { error: 'Sessão inválida.' };
      }
    } else if (path === '/auth/logout') {
      status = state.logoutStatus;
      if (status === 204) {
        state.access = false;
        state.refresh = false;
        state.csrf = '';
        data = '';
      } else data = { error: 'Não foi possível concluir a operação.' };
    }
    if (state.malformed && path !== '/auth/csrf') data = { user: null };
    return { status, statusText: '', data, headers: {}, config };
  };
  const client = axios.create({
    adapter,
    withCredentials: true,
    validateStatus: () => true,
  });
  function coordinator(): AuthCoordinator {
    return {
      exclusive<T>(operation: () => Promise<T>): Promise<T> {
        const result = tail.then(operation);
        tail = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
      notify(notice: SessionNotice): void {
        notices.push(notice);
      },
      subscribe(): () => void {
        return (): void => {};
      },
    };
  }
  function tab(): AuthClient {
    return new AuthClient(client, coordinator(), '/api');
  }
  return { tab, state, requests, notices };
}

test('RN02/RN03/RN07: runtime validates current API user and all documented roles', () => {
  for (const role of ['PLAYER', 'ADMIN', 'ORGANIZER'])
    assert.equal(
      parseAuthResponse({ user: { ...user, role } }).user.role,
      role,
    );
  for (const value of [
    null,
    {},
    { user: null },
    { user: { ...user, role: 'ROOT' } },
    { user, accessToken: 'forbidden' },
    { user: { ...user, passwordHash: 'forbidden' } },
  ])
    assert.throws(() => parseAuthResponse(value));
  assert.throws(() => parseCsrfResponse({ csrfToken: 'unexpected' }));
});

test('Form: validates email/bytes and preserves password whitespace', () => {
  assert.deepEqual(
    validateLogin({ email: user.email, password: ' secret ' }),
    {},
  );
  assert.equal(
    validateLogin({ email: 'bad', password: '' }).email,
    authContent.emailInvalid,
  );
  assert.equal(
    validateLogin({ email: user.email, password: 'é'.repeat(513) }).password,
    authContent.passwordTooLong,
  );
});

test('RN71: login sends exact payload; security: fresh CSRF, JSON and credentials', async () => {
  const f = fixture();
  const result = await f
    .tab()
    .login({ email: user.email, password: ' password unchanged ' });
  assert.equal(result.email, user.email);
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ['/auth/csrf', '/auth/login'],
  );
  assert.deepEqual(f.requests[1]?.body, {
    email: user.email,
    password: ' password unchanged ',
  });
  assert.equal(f.requests[1]?.csrf, f.state.csrf);
  assert.ok(f.requests.every((r) => r.credentials));
  assert.equal(f.state.rotations, 0);
});

test('Security: protected 401 refreshes once and retries /me only once', async () => {
  const f = fixture();
  assert.equal((await f.tab().restore()).status, 'authenticated');
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ['/auth/me', '/auth/csrf', '/auth/refresh', '/auth/me'],
  );
  assert.equal(f.state.rotations, 1);
});

test('Security: pending calls and two tabs share one rotation and valid CSRF', async () => {
  const f = fixture();
  const first = f.tab();
  const second = f.tab();
  const results = await Promise.all([
    first.restore(),
    first.restore(),
    second.restore(),
  ]);
  assert.ok(results.every((r) => r.status === 'authenticated'));
  assert.equal(f.state.rotations, 1);
  assert.equal(f.state.csrfRequests, 1);
  await Promise.all([
    first.login({ email: user.email, password: 'first' }),
    second.login({ email: user.email, password: 'second' }),
  ]);
  assert.deepEqual(
    f.requests.slice(-4).map((r) => r.path),
    ['/auth/csrf', '/auth/login', '/auth/csrf', '/auth/login'],
  );
});

test('Security: failed refresh ends session; next login obtains new CSRF; no loop', async () => {
  const f = fixture();
  f.state.refresh = false;
  const client = f.tab();
  assert.equal((await client.restore()).status, 'unauthenticated');
  assert.equal(f.state.rotations, 1);
  assert.deepEqual(f.notices, ['session-ended']);
  await client.login({ email: user.email, password: 'test' });
  assert.equal(f.state.csrfRequests, 2);
});

test('Security: repeated protected 401 stops after single retry', async () => {
  const f = fixture();
  f.state.meStatus = 401;
  assert.equal((await f.tab().restore()).status, 'unauthenticated');
  assert.equal(f.state.rotations, 1);
  assert.equal(f.requests.filter((r) => r.path === '/auth/me').length, 2);
});

test('Cross-tab notice: probes /me without refreshing or broadcasting another notice', async () => {
  const f = fixture();
  f.state.refresh = false;
  assert.equal((await f.tab().restore(false)).status, 'unauthenticated');
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ['/auth/me'],
  );
  assert.equal(f.state.rotations, 0);
  assert.deepEqual(f.notices, []);
});

test('RN71: login/Google 401 never renew; safe credential/configuration messages', async () => {
  const f = fixture();
  f.state.loginStatus = 401;
  await assert.rejects(
    f.tab().login({ email: user.email, password: 'wrong' }),
    (e: unknown) =>
      e instanceof AuthRequestError &&
      e.failure.message === authContent.credentialsInvalid,
  );
  f.state.googleStatus = 401;
  f.state.googleCode = 'GOOGLE_AUDIENCE_MISMATCH';
  await assert.rejects(
    f.tab().google({ idToken: 'Google-ID-token-fixture' }),
    (e: unknown) =>
      e instanceof AuthRequestError &&
      e.failure.message === authContent.googleAudience,
  );
  assert.equal(f.state.rotations, 0);
});

test('RN71–RN75: Google ID token sent to API, conflict does not simulate success', async () => {
  const f = fixture();
  await f.tab().google({ idToken: 'Google-ID-token-fixture' });
  assert.deepEqual(f.requests[1]?.body, { idToken: 'Google-ID-token-fixture' });
  f.state.googleStatus = 409;
  await assert.rejects(
    f.tab().google({ idToken: 'another-fixture' }),
    (e: unknown) =>
      e instanceof AuthRequestError &&
      e.failure.message === authContent.googleConflict,
  );
});

test('Session: transport failure differs from unauthenticated and hides raw errors', async () => {
  const f = fixture();
  f.state.network = true;
  const result = await f.tab().restore();
  assert.equal(result.status, 'error');
  if (result.status === 'error') {
    assert.equal(result.error.kind, 'communication');
    assert.equal(result.error.message, authContent.communication);
  }
});

test('Security: logout sends CSRF, ends session, next login obtains new CSRF', async () => {
  const f = fixture();
  const client = f.tab();
  f.state.access = true;
  await client.logout();
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ['/auth/csrf', '/auth/logout'],
  );
  assert.equal(f.state.refresh, false);
  assert.deepEqual(f.notices, ['session-ended']);
  await client.login({ email: user.email, password: 'test' });
  assert.equal(f.state.csrfRequests, 2);
});

test('Session: failed logout does not announce a successful sign-out', async () => {
  const f = fixture();
  f.state.logoutStatus = 500;
  f.state.access = true;
  await assert.rejects(f.tab().logout());
  assert.deepEqual(f.notices, []);
  assert.equal(f.state.access, true);
});

test('Session: authentication rejection at logout clears local session notice', async () => {
  const f = fixture();
  f.state.logoutStatus = 401;
  await f.tab().logout();
  assert.deepEqual(f.notices, ['session-ended']);
});

test('Boundary: malformed JSON and API errors never manufacture user success', async () => {
  const f = fixture();
  f.state.malformed = true;
  await assert.rejects(
    f.tab().login({ email: user.email, password: 'test' }),
    (e: unknown) =>
      e instanceof AuthRequestError && e.failure.kind === 'protocol',
  );
  f.state.malformed = false;
  for (const [status, expected] of [
    [403, authContent.csrfRejected],
    [429, authContent.rateLimited],
    [503, authContent.serverUnavailable],
  ]) {
    if (typeof status !== 'number' || typeof expected !== 'string')
      throw new Error('Invalid fixture');
    f.state.loginStatus = status;
    await assert.rejects(
      f.tab().login({ email: user.email, password: 'test' }),
      (e: unknown) =>
        e instanceof AuthRequestError && e.failure.message === expected,
    );
  }
  assert.equal(isRecord(null), false);
});

const registration = {
  firstName: 'Cadastro',
  lastName: 'Teste',
  email: 'cadastro@example.com',
  password: ' password with spaces ',
  confirmPassword: ' password with spaces ',
};

test('RN01: registration validates API limits and exact password confirmation', () => {
  assert.deepEqual(validateRegister(registration), {});
  const missing = validateRegister({
    firstName: ' ',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  for (const field of [
    'firstName',
    'lastName',
    'email',
    'password',
    'confirmPassword',
  ])
    assert.ok(Object.hasOwn(missing, field));
  assert.equal(
    validateRegister({
      ...registration,
      confirmPassword: registration.password.trim(),
    }).confirmPassword,
    authContent.confirmationMismatch,
  );
  assert.equal(
    validateRegister({
      ...registration,
      password: 'short',
      confirmPassword: 'short',
    }).password,
    authContent.passwordTooShort,
  );
  assert.deepEqual(
    validateRegister({
      ...registration,
      firstName: 'a'.repeat(100),
      lastName: 'b'.repeat(100),
      email: 'a'.repeat(242) + '@example.com',
      password: 'é'.repeat(512),
      confirmPassword: 'é'.repeat(512),
    }),
    {},
  );
  const large = validateRegister({
    ...registration,
    firstName: 'a'.repeat(101),
    lastName: 'b'.repeat(101),
    email: 'a'.repeat(243) + '@example.com',
    password: 'é'.repeat(513),
    confirmPassword: 'é'.repeat(513),
  });
  assert.equal(large.firstName, authContent.firstNameInvalid);
  assert.equal(large.lastName, authContent.lastNameInvalid);
  assert.equal(large.email, authContent.emailInvalid);
  assert.equal(large.password, authContent.passwordTooLong);
});

test('RN01/RN02/RN71: 201 registration opens session with exact payload, no role or confirmation', async () => {
  const f = fixture();
  const input = {
    ...toRegisterRequest(registration),
    role: 'ORGANIZER',
    confirmPassword: registration.confirmPassword,
  };
  const result = await f.tab().register(input);
  assert.equal(result.role, 'PLAYER');
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ['/auth/csrf', '/auth/register'],
  );
  assert.deepEqual(f.requests[1]?.body, {
    email: registration.email,
    password: registration.password,
    firstName: registration.firstName,
    lastName: registration.lastName,
  });
  assert.equal(f.requests[1]?.csrf, f.state.csrf);
  assert.ok(f.requests.every((r) => r.credentials));
  assert.deepEqual(f.notices, ['session-changed']);
  assert.equal((await f.tab().restore()).status, 'authenticated');
  assert.equal(f.state.rotations, 0);
  assert.equal(f.requests.filter((r) => r.path === '/auth/login').length, 0);
});

test('RN63/RN74: duplicate registration never links, retries or announces success; safe errors', async () => {
  for (const [status, message] of [
    [409, authContent.registerConflict],
    [400, authContent.registerInvalid],
    [401, authContent.registerInvalid],
    [403, authContent.csrfRejected],
    [429, authContent.rateLimited],
    [503, authContent.serverUnavailable],
  ]) {
    if (typeof status !== 'number' || typeof message !== 'string')
      throw new Error('Invalid fixture');
    const f = fixture();
    f.state.registerStatus = status;
    await assert.rejects(
      f.tab().register(toRegisterRequest(registration)),
      (error: unknown) =>
        error instanceof AuthRequestError && error.failure.message === message,
    );
    assert.deepEqual(
      f.requests.map((r) => r.path),
      ['/auth/csrf', '/auth/register'],
    );
    assert.deepEqual(f.notices, []);
    assert.equal(f.state.rotations, 0);
  }
});

test('Security: registration coordinates CSRF with login and rejects malformed/network responses', async () => {
  const f = fixture();
  await Promise.all([
    f.tab().register(toRegisterRequest(registration)),
    f.tab().login({ email: user.email, password: 'existing password' }),
  ]);
  assert.deepEqual(
    f.requests.map((r) => r.path),
    ['/auth/csrf', '/auth/register', '/auth/csrf', '/auth/login'],
  );
  const malformed = fixture();
  malformed.state.malformed = true;
  await assert.rejects(
    malformed.tab().register(toRegisterRequest(registration)),
    (error: unknown) =>
      error instanceof AuthRequestError && error.failure.kind === 'protocol',
  );
  assert.deepEqual(malformed.notices, []);
  const network = fixture();
  network.state.network = true;
  await assert.rejects(network.tab().register(toRegisterRequest(registration)));
  assert.deepEqual(network.notices, []);
});
