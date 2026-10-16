import { authClient } from '../auth/browser-client';
import { isRecord, parseApiError } from '../auth/auth.contracts';
import { EventRequestError } from '../events/events.service';

export interface MatchPlayer {
  id: string;
  name: string;
  participantType: 'USER' | 'GUEST';
}
export interface Goal {
  id: string;
  teamId: string;
  scorerParticipantId: string | null;
  assistParticipantId: string | null;
  minute: number | null;
  ownGoal: boolean;
}
export interface Match {
  id: string;
  eventId: string;
  revision: number;
  status: 'PENDING' | 'IN_PROGRESS';
  durationMinutes: number;
  startedAt: string | null;
  teamA: { id: string; name: string; players: MatchPlayer[] };
  teamB: { id: string; name: string; players: MatchPlayer[] };
  score: { teamA: number; teamB: number };
  goals: Goal[];
}
function bad(): never {
  throw new Error('Resposta de súmula inválida.');
}
function text(v: unknown): string {
  return typeof v === 'string' ? v : bad();
}
function id(v: unknown): string {
  const s = text(v);
  return /^[a-f\d]{24}$/i.test(s) ? s : bad();
}
function integer(v: unknown): number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : bad();
}
function nullableId(v: unknown): string | null {
  return v === null ? null : id(v);
}
function team(v: unknown): Match['teamA'] {
  if (!isRecord(v) || !Array.isArray(v.players)) return bad();
  return {
    id: id(v.id),
    name: text(v.name),
    players: v.players.map((p: unknown) => {
      if (
        !isRecord(p) ||
        (p.participantType !== 'USER' && p.participantType !== 'GUEST')
      )
        return bad();
      return {
        id: id(p.id),
        name: text(p.name),
        participantType: p.participantType,
      };
    }),
  };
}
export function parseMatch(v: unknown): Match {
  if (
    !isRecord(v) ||
    (v.status !== 'IN_PROGRESS' && v.status !== 'PENDING') ||
    !Array.isArray(v.goals) ||
    !isRecord(v.score)
  )
    return bad();
  const startedAt = v.startedAt === null ? null : text(v.startedAt);
  if (
    (v.status === 'IN_PROGRESS' &&
      (startedAt === null || !Number.isFinite(Date.parse(startedAt)))) ||
    integer(v.durationMinutes) < 1
  )
    return bad();
  return {
    id: id(v.id),
    eventId: id(v.eventId),
    revision: integer(v.revision),
    status: v.status,
    durationMinutes: integer(v.durationMinutes),
    startedAt,
    teamA: team(v.teamA),
    teamB: team(v.teamB),
    score: { teamA: integer(v.score.teamA), teamB: integer(v.score.teamB) },
    goals: v.goals.map((g: unknown) => {
      if (!isRecord(g) || typeof g.ownGoal !== 'boolean') return bad();
      return {
        id: id(g.id),
        teamId: id(g.teamId),
        scorerParticipantId: nullableId(g.scorerParticipantId),
        assistParticipantId: nullableId(g.assistParticipantId),
        ownGoal: g.ownGoal,
        minute: g.minute === null ? null : integer(g.minute),
      };
    }),
  };
}
export async function matchRequest<T>(
  path: string,
  body: Record<string, unknown> | undefined,
  parse: (v: unknown) => T,
): Promise<T> {
  let response;
  try {
    response = await authClient.protectedRequest(path, body);
  } catch {
    throw new EventRequestError(
      0,
      body
        ? 'Não foi possível confirmar a operação. Atualize a súmula antes de tentar novamente.'
        : 'Não foi possível carregar as súmulas.',
    );
  }
  if (response.status < 200 || response.status >= 300)
    throw new EventRequestError(
      response.status,
      parseApiError(response.data)?.error ??
        'Não foi possível concluir a operação.',
    );
  try {
    return parse(response.data);
  } catch {
    throw new EventRequestError(
      0,
      'Resposta inválida. Atualize e confira os registros.',
    );
  }
}
export function listMatches(eventId: string): Promise<Match[]> {
  return matchRequest(`/events/${eventId}/matches`, undefined, (v) => {
    if (!isRecord(v) || !Array.isArray(v.matches)) return bad();
    return v.matches.map(parseMatch);
  });
}
export function loadMatch(eventId: string, matchId: string): Promise<Match> {
  return matchRequest(
    `/events/${eventId}/matches/${matchId}`,
    undefined,
    parseMatch,
  );
}
