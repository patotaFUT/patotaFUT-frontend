import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { AuthClient } from '../src/features/auth/auth.service';
import type { AuthCoordinator } from '../src/features/auth/auth-coordinator';
import {
  EventsClient,
  EventRequestError,
} from '../src/features/events/events.service';
import {
  parseDetail,
  parseEvents,
  parseParticipants,
} from '../src/features/events/events.contracts';
import { formationError } from '../src/features/events/events.validation';
import { validateEvent } from '../src/features/events/events.validation';
import {
  formatEventDate,
  parseDisplayDate,
} from '../src/features/events/events.calendar';
const id = '507f1f77bcf86cd799439011';
const user = {
  id,
  email: 'events@example.invalid',
  firstName: 'Event',
  lastName: 'Fixture',
  role: 'ORGANIZER',
};
const event = {
  id,
  name: 'Fixture',
  date: '2026-10-10',
  startTime: '20:00',
  endTime: '21:30',
  status: 'ACTIVE',
  revision: 1,
  confirmedCount: 11,
  ownPresence: 'CONFIRMED',
  ownAllocated: false,
  ownParticipantId: null,
};
const detail = { event, teams: [] };
function fixture() {
  let tail: Promise<void> = Promise.resolve();
  let csrf = '';
  const calls: {
    url: string;
    csrf: unknown;
    body: unknown;
    credentials: boolean | undefined;
  }[] = [];
  const state = {
    unauthorized: false,
    always401: false,
    network: false,
    status: 200,
    malformed: false,
    refreshFailed: false,
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
    notify() {},
    subscribe() {
      return () => undefined;
    },
  };
  const adapter: AxiosAdapter = async (
    config: InternalAxiosRequestConfig<unknown>,
  ) => {
    if (state.network) throw new Error('Sensitive transport body');
    const url = config.url ?? '';
    const raw: unknown = config.data;
    const body: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    calls.push({
      url,
      body,
      csrf: config.headers.get('X-CSRF-Token'),
      credentials: config.withCredentials,
    });
    let data: unknown = detail;
    let status = state.status;
    if (url === '/auth/csrf') {
      csrf = `${calls.length.toString(16).padStart(64, '0')}.${'a'.repeat(64)}`;
      data = { csrfToken: csrf };
      status = 200;
    } else if (url === '/auth/refresh') {
      status = state.refreshFailed ? 401 : 200;
      data = { user };
      state.unauthorized = false;
      assert.equal(config.headers.get('X-CSRF-Token'), csrf);
    } else if (state.unauthorized || state.always401) status = 401;
    else if (config.method === 'post')
      assert.equal(config.headers.get('X-CSRF-Token'), csrf);
    else if (url.includes('/participants'))
      data = { items: [], nextCursor: null, revision: 1, total: 11 };
    else if (url.startsWith('/events?'))
      data = { items: [event], nextCursor: null };
    if (status >= 400) data = { error: 'Dados alterados. Atualize o evento.' };
    if (state.malformed) data = { unsafe: 'invalid' };
    return { data, status, statusText: '', headers: {}, config };
  };
  const auth = new AuthClient(
    axios.create({
      adapter,
      withCredentials: true,
      validateStatus: () => true,
    }),
    coordinator,
    'http://localhost:8080',
  );
  return {
    state,
    calls,
    auth,
    client: new EventsClient((path, body) => auth.protectedRequest(path, body)),
  };
}
test('Authorized minimum: N >= 2X allows all complete groups and rejects invalid X', () => {
  assert.ok(formationError(5, 9));
  for (const n of [10, 11, 17]) assert.equal(formationError(5, n), undefined);
  for (const x of [0, -1, 1.5, NaN, Infinity]) assert.ok(formationError(x, 17));
  assert.equal(formationError(101, 202), undefined);
});
test('DTOs validate IDs, enums, revisions and serialized dates without Mongoose', () => {
  assert.deepEqual(parseDetail(detail), detail);
  assert.throws(() =>
    parseDetail({ event: { ...event, status: 'REOPENED' }, teams: [] }),
  );
  assert.throws(() =>
    parseEvents({ items: [{ ...event, id: 'invalid' }], nextCursor: null }),
  );
  assert.throws(() =>
    parseParticipants({ items: [], nextCursor: 'bad', revision: 1, total: 0 }),
  );
  assert.throws(() =>
    parseDetail({ event: { ...event, revision: -1 }, teams: [] }),
  );
});
test('Civil event calendar: display DD/MM/YYYY, exact API YYYY-MM-DD, no timezone shift, strict clock and same-day end', () => {
  assert.equal(formatEventDate('2026-12-31'), '31/12/2026');
  assert.equal(parseDisplayDate('31/12/2026'), '2026-12-31');
  assert.equal(parseDisplayDate('29/02/2028'), '2028-02-29');
  for (const invalid of ['29/02/2026', '31/04/2026', '2026-12-31', '1/1/2026'])
    assert.equal(parseDisplayDate(invalid), undefined);
  const input = {
    name: event.name,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
  };
  assert.deepEqual(validateEvent(input), {});
  for (const time of ['24:00', '21:60', '9:00', '20:00:00'])
    assert.ok(validateEvent({ ...input, startTime: time }).startTime);
  for (const end of ['20:00', '19:00', '00:01'])
    assert.ok(validateEvent({ ...input, endTime: end }).endTime);
  assert.throws(() =>
    parseDetail({
      event: { ...event, date: '2026-10-10T00:00:00.000Z' },
      teams: [],
    }),
  );
  assert.throws(() =>
    parseDetail({ event: { ...event, date: '2026-02-30' }, teams: [] }),
  );
});
test('Create/edit frontend contracts send calendar fields and revision; server confirmation is mandatory', async () => {
  const f = fixture();
  const input = {
    name: event.name,
    date: '2026-12-31',
    startTime: '20:00',
    endTime: '21:30',
  };
  await f.client.create(input);
  assert.deepEqual(f.calls.at(-1)?.body, input);
  assert.equal(f.calls.at(-1)?.url, '/events');
  await f.client.edit(id, 7, input);
  assert.deepEqual(f.calls.at(-1)?.body, { ...input, revision: 7 });
  assert.equal(f.calls.at(-1)?.url, `/events/${id}/edit`);
  f.state.status = 400;
  await assert.rejects(() => f.client.create(input));
  f.state.status = 409;
  await assert.rejects(() => f.client.edit(id, 7, input));
});
test('Real endpoint contracts use credentials and CSRF under existing auth coordination', async () => {
  const f = fixture();
  assert.equal(
    (await f.client.list(undefined, 'Amigos', 'ACTIVE')).items.length,
    1,
  );
  assert.equal((await f.client.participants(id)).total, 11);
  await f.client.action(id, 'formation', 1, { playersPerTeam: 5 });
  const request = f.calls.at(-1);
  assert.ok(request);
  assert.deepEqual(request.body, { revision: 1, playersPerTeam: 5 });
  assert.equal(request.url, `/events/${id}/formation`);
  assert.equal(request.credentials, true);
});
test('Protected routes refresh once on 401; mutation retries only after authentication rejection', async () => {
  const f = fixture();
  f.state.unauthorized = true;
  await f.client.action(id, 'presence', 1, { status: 'CONFIRMED' });
  assert.equal(
    f.calls.filter((call) => call.url === '/auth/refresh').length,
    1,
  );
  assert.equal(
    f.calls.filter((call) => call.url === `/events/${id}/presence`).length,
    2,
  );
  f.state.always401 = true;
  await assert.rejects(
    () => f.client.detail(id),
    (error: unknown) =>
      error instanceof EventRequestError && error.status === 401,
  );
  assert.equal(
    f.calls.filter((call) => call.url === '/auth/refresh').length,
    2,
  );
});
test('Conflict, forbidden, uncertain network responses and malformed success never report success or replay', async () => {
  const f = fixture();
  for (const status of [400, 403, 409, 500]) {
    f.state.status = status;
    const before = f.calls.length;
    await assert.rejects(() =>
      f.client.action(id, 'formation', 1, { playersPerTeam: 5 }),
    );
    assert.equal(f.calls.length - before, 2);
  }
  f.state.status = 200;
  f.state.network = true;
  await assert.rejects(
    () => f.client.action(id, 'guests', 1, { name: 'Guest' }),
    (error: unknown) =>
      error instanceof EventRequestError &&
      !error.message.includes('Sensitive') &&
      error.message.includes('Atualize'),
  );
  f.state.network = false;
  f.state.malformed = true;
  await assert.rejects(() => f.client.detail(id));
});
test('Concurrent protected mutations coordinate a fresh CSRF GET and POST as one operation', async () => {
  const f = fixture();
  await Promise.all([
    f.client.action(id, 'presence', 1, { status: 'CONFIRMED' }),
    f.client.action(id, 'formation', 2, { playersPerTeam: 5 }),
  ]);
  assert.deepEqual(
    f.calls.map((call) => call.url),
    [
      '/auth/csrf',
      `/events/${id}/presence`,
      '/auth/csrf',
      `/events/${id}/formation`,
    ],
  );
});

import { safeReturn } from '../src/features/events/navigation';
test('Navigation: validated internal returns preserve context and reject external or unknown targets', () => {
  for (const value of [
    'https://evil.invalid',
    '//evil.invalid/events',
    '/stats',
    '/events?role=ORGANIZER',
    '/org/events/invalid',
    '/events#outside',
    '/events?returnTo=%2Fstats',
  ])
    assert.equal(safeReturn(value, '/org/events'), '/org/events');
  assert.equal(
    safeReturn(
      '/events?q=test&page=1&after=507f1f77bcf86cd799439011&slide=1&scroll=90',
      '',
    ),
    '/events?q=test&page=1&after=507f1f77bcf86cd799439011&slide=1&scroll=90',
  );
  assert.equal(
    safeReturn(
      '/org/events/507f1f77bcf86cd799439011?returnTo=%2Forg%2Fevents%3Fq%3Dtest',
      '',
    ),
    '/org/events/507f1f77bcf86cd799439011?returnTo=%2Forg%2Fevents%3Fq%3Dtest',
  );
});
test('Own participant identity: optional legacy response, strict ID and session-owned serialized reference', () => {
  assert.equal(
    parseDetail({ event: { ...event, ownParticipantId: id }, teams: [] }).event
      .ownParticipantId,
    id,
  );
  assert.throws(() =>
    parseDetail({
      event: { ...event, ownParticipantId: 'invalid' },
      teams: [],
    }),
  );
  const { ownParticipantId: omitted, ...legacy } = event;
  assert.equal(
    parseDetail({ event: legacy, teams: [] }).event.ownParticipantId,
    null,
  );
});
