export interface AccountProfile {
  googleLinked: boolean;
  localCredentials: boolean;
}
export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
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
  const items = data.items.map((item) => {
    const row = accountRecord(item);
    const { id, firstName, lastName, email, role } = row;
    if (
      typeof id !== 'string' ||
      typeof firstName !== 'string' ||
      typeof lastName !== 'string' ||
      typeof email !== 'string' ||
      typeof role !== 'string'
    )
      throw new Error('Resposta inválida do servidor.');
    return { id, firstName, lastName, email, role };
  });
  return { items, nextCursor: data.nextCursor };
}
