import type { UserRole } from '../auth/auth.contracts';

export type OrganizationPage = 'home' | 'members' | 'preferences';
export type OrganizationAccess =
  | 'events'
  | 'matches'
  | 'members'
  | 'preferences';
const accesses: {
  id: OrganizationAccess;
  title: string;
  href: string;
  minimum: UserRole;
}[] = [
  { id: 'events', title: 'Eventos', href: '/org/events', minimum: 'ADMIN' },
  { id: 'matches', title: 'Súmulas', href: '/org/matches', minimum: 'ADMIN' },
  {
    id: 'members',
    title: 'Integrantes',
    href: '/org/members',
    minimum: 'ORGANIZER',
  },
  {
    id: 'preferences',
    title: 'Preferências',
    href: '/org/preferences',
    minimum: 'PLAYER',
  },
];
const level: Record<UserRole, number> = { PLAYER: 0, ADMIN: 1, ORGANIZER: 2 };

// Presentation only. Existing Services continue authorizing every API operation.
export function organizationAccesses(role: UserRole) {
  return accesses.filter((access) => level[role] >= level[access.minimum]);
}
export function canOpenOrganizationPage(
  role: UserRole,
  page: OrganizationPage,
): boolean {
  return page !== 'members' || role === 'ORGANIZER';
}
