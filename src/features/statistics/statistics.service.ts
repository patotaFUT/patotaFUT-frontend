import { parseApiError } from '../auth/auth.contracts';
import { EventRequestError } from '../events/events.service';
import type { EventTransport } from '../events/events.service';
import { parseHighlights, parseStatistics } from './statistics.contracts';
import type { Period } from './statistics.contracts';
export class StatisticsClient {
  constructor(private readonly request: EventTransport) {}
  private async get<T>(path: string, parse: (value: unknown) => T): Promise<T> {
    let response;
    try {
      response = await this.request(path);
    } catch {
      throw new EventRequestError(
        0,
        'Não foi possível carregar as estatísticas. Tente novamente.',
      );
    }
    if (response.status < 200 || response.status >= 300)
      throw new EventRequestError(
        response.status,
        response.status >= 500
          ? 'Não foi possível carregar as estatísticas. Tente novamente.'
          : (parseApiError(response.data)?.error ??
            'Não foi possível carregar as estatísticas.'),
      );
    try {
      return parse(response.data);
    } catch {
      throw new EventRequestError(0, 'Resposta inválida da API.');
    }
  }
  list(period?: Period) {
    const query =
      period === undefined ? '' : `?${new URLSearchParams({ ...period })}`;
    return this.get(`/statistics${query}`, parseStatistics);
  }
  highlights(eventId: string) {
    return this.get(
      `/events/${encodeURIComponent(eventId)}/highlights`,
      parseHighlights,
    );
  }
}
