import type { AxiosResponse } from 'axios';
import { parseApiError } from '../auth/auth.contracts';
import {
  parseDetail,
  parseEvents,
  parseParticipants,
} from './events.contracts';
import type { EventInput, EventStatus } from './events.contracts';
import { eventContent } from './events.content';

export class EventRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export type EventTransport = (
  path: string,
  body?: Record<string, unknown>,
) => Promise<AxiosResponse<unknown>>;
export class EventsClient {
  constructor(private readonly request: EventTransport) {}
  private async execute<T>(
    path: string,
    body: Record<string, unknown> | undefined,
    parse: (value: unknown) => T,
  ): Promise<T> {
    let response: AxiosResponse<unknown>;
    try {
      response = await this.request(path, body);
    } catch {
      throw new EventRequestError(
        0,
        body === undefined
          ? eventContent.communication
          : eventContent.uncertain,
      );
    }
    if (response.status < 200 || response.status >= 300) {
      const error = parseApiError(response.data);
      throw new EventRequestError(
        response.status,
        response.status === 401
          ? 'Sua sessão terminou. Entre novamente.'
          : response.status >= 500
            ? body === undefined
              ? eventContent.communication
              : eventContent.uncertain
            : (error?.error ?? 'Não foi possível concluir a operação.'),
      );
    }
    try {
      return parse(response.data);
    } catch {
      throw new EventRequestError(
        0,
        body === undefined
          ? 'Resposta inválida da API.'
          : eventContent.uncertain,
      );
    }
  }
  list(cursor?: string, search = '', status?: EventStatus) {
    const query = new URLSearchParams({ limit: '8', search });
    if (cursor !== undefined) query.set('cursor', cursor);
    if (status !== undefined) query.set('status', status);
    return this.execute(`/events?${query}`, undefined, parseEvents);
  }
  detail(id: string) {
    return this.execute(
      `/events/${encodeURIComponent(id)}`,
      undefined,
      parseDetail,
    );
  }
  participants(id: string, cursor?: string) {
    return this.execute(
      `/events/${encodeURIComponent(id)}/participants?limit=50${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}`,
      undefined,
      parseParticipants,
    );
  }
  create(input: EventInput) {
    return this.execute('/events', { ...input }, parseDetail);
  }
  edit(id: string, revision: number, input: EventInput) {
    return this.execute(
      `/events/${id}/edit`,
      { ...input, revision },
      parseDetail,
    );
  }
  action(
    id: string,
    path: string,
    revision: number,
    input: Record<string, unknown> = {},
  ) {
    return this.execute(
      `/events/${id}/${path}`,
      { ...input, revision },
      parseDetail,
    );
  }
}
