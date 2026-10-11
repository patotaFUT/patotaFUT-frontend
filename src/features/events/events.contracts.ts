import { isCalendarDate, isClockTime } from './events.calendar';
export type EventStatus = 'ACTIVE' | 'CANCELED' | 'FINISHED';
export interface EventDto {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  status: EventStatus;
  revision: number;
  confirmedCount: number;
  ownPresence: 'CONFIRMED' | 'CANCELED' | null;
  ownAllocated: boolean;
  ownParticipantId: string | null;
}
export interface ParticipantDto {
  id: string;
  name: string;
  participantType: 'USER' | 'GUEST';
  allocated: boolean;
}
export interface TeamDto {
  id: string;
  name: string;
  type: 'TEAM' | 'RESERVES';
  members: ParticipantDto[];
}
export interface EventDetail {
  event: EventDto;
  teams: TeamDto[];
}
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
export interface ParticipantPage extends Page<ParticipantDto> {
  revision: number;
  total: number;
}
export interface EventInput {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function bad(): never {
  throw new Error('Resposta inválida da API.');
}
function id(value: unknown): string {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)
    ? value
    : bad();
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : bad();
}
function number(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : bad();
}
function boolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : bad();
}
export function parseEvent(value: unknown): EventDto {
  if (!record(value)) return bad();
  const status = value['status'];
  const presence = value['ownPresence'];
  if (status !== 'ACTIVE' && status !== 'CANCELED' && status !== 'FINISHED')
    return bad();
  if (presence !== null && presence !== 'CONFIRMED' && presence !== 'CANCELED')
    return bad();
  const date = text(value['date']);
  const startTime = text(value['startTime']);
  const endTime = text(value['endTime']);
  if (
    !isCalendarDate(date) ||
    !isClockTime(startTime) ||
    !isClockTime(endTime) ||
    endTime <= startTime
  )
    return bad();
  return {
    id: id(value['id']),
    name: text(value['name']),
    date,
    startTime,
    endTime,
    status,
    revision: number(value['revision']),
    confirmedCount: number(value['confirmedCount']),
    ownPresence: presence,
    ownAllocated: boolean(value['ownAllocated']),
    ownParticipantId:
      value['ownParticipantId'] == null ? null : id(value['ownParticipantId']),
  };
}
export function parseParticipant(value: unknown): ParticipantDto {
  if (!record(value)) return bad();
  const type = value['participantType'];
  if (type !== 'USER' && type !== 'GUEST') return bad();
  return {
    id: id(value['id']),
    name: text(value['name']),
    participantType: type,
    allocated: boolean(value['allocated']),
  };
}
export function parseTeam(value: unknown): TeamDto {
  if (!record(value) || !Array.isArray(value['members'])) return bad();
  const type = value['type'];
  if (type !== 'TEAM' && type !== 'RESERVES') return bad();
  const members: unknown[] = value['members'];
  return {
    id: id(value['id']),
    name: text(value['name']),
    type,
    members: members.map(parseParticipant),
  };
}
export function parseDetail(value: unknown): EventDetail {
  if (!record(value) || !Array.isArray(value['teams'])) return bad();
  const teams: unknown[] = value['teams'];
  return { event: parseEvent(value['event']), teams: teams.map(parseTeam) };
}
function page<T>(value: unknown, parse: (item: unknown) => T): Page<T> {
  if (!record(value) || !Array.isArray(value['items'])) return bad();
  const items: unknown[] = value['items'];
  return {
    items: items.map(parse),
    nextCursor: value['nextCursor'] === null ? null : id(value['nextCursor']),
  };
}
export function parseEvents(value: unknown): Page<EventDto> {
  return page(value, parseEvent);
}
export function parseParticipants(value: unknown): ParticipantPage {
  if (!record(value)) return bad();
  return {
    ...page(value, parseParticipant),
    revision: number(value['revision']),
    total: number(value['total']),
  };
}
