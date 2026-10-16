import { isCalendarDate } from '../events/events.calendar';
export interface RankingRow {
  userId: string;
  firstName: string;
  lastName: string;
  goals: number;
  assists: number;
  position: number;
}
export interface Rankings {
  scorers: RankingRow[];
  assistants: RankingRow[];
}
export interface Period {
  from: string;
  to: string;
}
export interface StatisticsDto extends Rankings {
  period: Period;
  finishedMatchCount: number;
}
export interface EventHighlights extends Rankings {
  eventId: string;
  revision: number;
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
function integer(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : bad();
}
function rows(value: unknown): RankingRow[] {
  if (!Array.isArray(value)) return bad();
  return value.map((row: unknown) => {
    if (
      !record(row) ||
      typeof row['firstName'] !== 'string' ||
      typeof row['lastName'] !== 'string'
    )
      return bad();
    const position = integer(row['position']);
    if (position < 1) return bad();
    return {
      userId: id(row['userId']),
      firstName: row['firstName'],
      lastName: row['lastName'],
      goals: integer(row['goals']),
      assists: integer(row['assists']),
      position,
    };
  });
}
export function parseStatistics(value: unknown): StatisticsDto {
  if (!record(value) || !record(value['period'])) return bad();
  const from = value['period']['from'],
    to = value['period']['to'];
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !isCalendarDate(from) ||
    !isCalendarDate(to) ||
    from > to
  )
    return bad();
  return {
    period: { from, to },
    finishedMatchCount: integer(value['finishedMatchCount']),
    scorers: rows(value['scorers']),
    assistants: rows(value['assistants']),
  };
}
export function parseHighlights(value: unknown): EventHighlights {
  if (!record(value)) return bad();
  return {
    eventId: id(value['eventId']),
    revision: integer(value['revision']),
    scorers: rows(value['scorers']),
    assistants: rows(value['assistants']),
  };
}
export function searchRanking(
  ranking: RankingRow[],
  search: string,
): RankingRow[] {
  const query = search.trim().toLocaleLowerCase('pt-BR');
  return ranking.filter((row) =>
    `${row.firstName} ${row.lastName}`
      .toLocaleLowerCase('pt-BR')
      .includes(query),
  );
}
