import { authContent } from './auth.content';

export type SessionNotice = 'session-changed' | 'session-ended';
export interface AuthCoordinator {
  exclusive<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T>;
  notify(notice: SessionNotice): void;
  subscribe(listener: (notice: SessionNotice) => void): () => void;
}

export function createBrowserCoordinator(apiUrl: string): AuthCoordinator {
  const name = `patotafut-auth:${apiUrl}`;
  let channel: BroadcastChannel | undefined;
  const listeners = new Set<(notice: SessionNotice) => void>();
  function connect(): void {
    if (channel !== undefined) return;
    if (typeof BroadcastChannel === 'undefined')
      throw new Error(authContent.browserUnsupported);
    channel = new BroadcastChannel(name);
    channel.onmessage = (event: MessageEvent<unknown>): void => {
      if (event.data === 'session-changed' || event.data === 'session-ended') {
        const notice = event.data;
        listeners.forEach((listener) => listener(notice));
      }
    };
  }
  return {
    async exclusive<T>(
      operation: () => Promise<T>,
      signal?: AbortSignal,
    ): Promise<T> {
      if (typeof navigator === 'undefined' || navigator.locks === undefined)
        throw new Error(authContent.browserUnsupported);
      connect();
      return navigator.locks.request(
        name,
        { mode: 'exclusive', ...(signal === undefined ? {} : { signal }) },
        operation,
      );
    },
    notify(notice: SessionNotice): void {
      channel?.postMessage(notice);
    },
    subscribe(listener: (notice: SessionNotice) => void): () => void {
      connect();
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}
