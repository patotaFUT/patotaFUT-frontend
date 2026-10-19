import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseProfile,
  parseMembers,
} from '../src/features/account/account.contracts';
import { proxyTimeout } from '../src/features/auth/access-timing';
test('RN116: preferences capability requires explicit server booleans', () => {
  assert.deepEqual(
    parseProfile({ googleLinked: true, localCredentials: false }),
    { googleLinked: true, localCredentials: false },
  );
  for (const bad of [
    null,
    [],
    {},
    { googleLinked: 'false', localCredentials: true },
    { googleLinked: true, localCredentials: true },
  ])
    assert.throws(() => parseProfile(bad));
});
test('RN60: member contracts validate listing and pagination without accepting malformed identities', () => {
  const item = {
    id: 'fixture',
    firstName: 'Nome',
    lastName: 'Fixture',
    email: 'fixture@example.invalid',
    role: 'PLAYER',
  };
  assert.deepEqual(parseMembers({ items: [item], nextCursor: null }), {
    items: [item],
    nextCursor: null,
  });
  for (const bad of [
    null,
    { items: 'wrong', nextCursor: null },
    { items: [{}], nextCursor: null },
    { items: [item], nextCursor: 1 },
  ])
    assert.throws(() => parseMembers(bad));
});
test('RN114: confirmation-code delivery budget covers both Gmail operations; other requests keep their limits', () => {
  assert.equal(
    proxyTimeout(['account', 'preferences', 'email', 'request']),
    30000,
  );
  assert.equal(proxyTimeout(['account', 'preferences', 'delete']), 15000);
});
