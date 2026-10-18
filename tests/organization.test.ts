import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';
import {
  organizationAccesses,
  canOpenOrganizationPage,
} from '../src/features/organization/organization.access';

test('RN03/RN05–RN08/RN38/RN56–RN59: central access visibility respects the existing role hierarchy', () => {
  assert.deepEqual(
    organizationAccesses('PLAYER').map((access) => access.id),
    ['preferences'],
  );
  assert.deepEqual(
    organizationAccesses('ADMIN').map((access) => access.id),
    ['events', 'matches', 'preferences'],
  );
  assert.deepEqual(
    organizationAccesses('ORGANIZER').map((access) => access.id),
    ['events', 'matches', 'members', 'preferences'],
  );
  for (const role of ['PLAYER', 'ADMIN', 'ORGANIZER'] satisfies (
    | 'PLAYER'
    | 'ADMIN'
    | 'ORGANIZER'
  )[]) {
    assert.equal(canOpenOrganizationPage(role, 'home'), true);
    assert.equal(canOpenOrganizationPage(role, 'preferences'), true);
    assert.equal(
      canOpenOrganizationPage(role, 'members'),
      role === 'ORGANIZER',
    );
  }
});

test('Uppercase entry redirects once to canonical /org, keeping query parameters and specific routes intact', () => {
  const redirected = proxy(
    new NextRequest('http://localhost:3000/ORG?source=bookmark'),
  );
  assert.equal(redirected.status, 308);
  assert.equal(
    redirected.headers.get('location'),
    'http://localhost:3000/org?source=bookmark',
  );
  for (const path of [
    '/org',
    '/org/events',
    '/org/matches',
    '/org/preferences',
    '/stats',
  ]) {
    assert.equal(
      proxy(new NextRequest(`http://localhost:3000${path}`)).headers.get(
        'location',
      ),
      null,
    );
  }
});
