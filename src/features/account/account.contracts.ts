import type { UserRole } from '../auth/auth.contracts';

export interface AccountProfile {
  googleLinked: boolean;
  localCredentials: boolean;
}
export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}
export interface MemberPage {
  items: Member[];
  nextCursor: string | null;
}
export function accountRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Resposta inválida do servidor.');
  return Object.fromEntries(Object.entries(value));
}
export function parseProfile(value: unknown): AccountProfile {
  const data = accountRecord(value);
  if (
    typeof data.googleLinked !== 'boolean' ||
    typeof data.localCredentials !== 'boolean' ||
    (data.googleLinked && data.localCredentials)
  )
    throw new Error('Resposta inválida do servidor.');
  return {
    googleLinked: data.googleLinked,
    localCredentials: data.localCredentials,
  };
}
export function parseMembers(value: unknown): MemberPage {
  const data = accountRecord(value);
  if (
    !Array.isArray(data.items) ||
    (data.nextCursor !== null && typeof data.nextCursor !== 'string')
  )
    throw new Error('Resposta inválida do servidor.');
  const items = data.items.map(parseMember);
  return { items, nextCursor: data.nextCursor };
}
export function parseMember(item: unknown): Member {
  const row = accountRecord(item);
  const { id, firstName, lastName, role } = row;
  if (
    typeof id !== 'string' ||
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    !isMemberRole(role) ||
    Object.keys(row).some(
      (key) => !['id', 'firstName', 'lastName', 'role'].includes(key),
    )
  )
    throw new Error('Resposta inválida do servidor.');
  return { id, firstName, lastName, role };
}
export function isMemberRole(value: unknown): value is UserRole {
  return value === 'PLAYER' || value === 'ADMIN' || value === 'ORGANIZER';
}
