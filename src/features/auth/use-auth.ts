'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { authClient } from './browser-client';
import { safeFailure } from './auth.service';
import type {
  AuthFailure,
  AuthOperation,
  LoginRequest,
  RegisterRequest,
  SessionState,
} from './auth.contracts';

export function useAuth() {
  const [session, setSession] = useState<SessionState>({ status: 'checking' });
  const [operation, setOperation] = useState<AuthOperation>('idle');
  const [error, setError] = useState<AuthFailure | undefined>();
  const [success, setSuccess] = useState(false);
  const busy = useRef(false);
  const pendingNotice = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(false);

  const restore = useCallback(async (renew = true): Promise<void> => {
    const current = ++revision.current;
    const result = await authClient.restore(renew);
    if (mounted.current && revision.current === current) {
      setSession(result);
      setSuccess(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void restore();
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = authClient.subscribe(() => {
        if (busy.current) {
          pendingNotice.current = true;
          return;
        }
        void restore(false);
      });
    } catch (caught: unknown) {
      setError(safeFailure(caught));
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible' && !busy.current)
        void restore();
    };
    document.addEventListener('visibilitychange', onVisible);
    return (): void => {
      mounted.current = false;
      revision.current++;
      unsubscribe?.();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [restore]);

  async function run(
    kind: Exclude<AuthOperation, 'idle'>,
    action: () => Promise<void>,
  ): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    revision.current++;
    setOperation(kind);
    setError(undefined);
    try {
      await action();
    } catch (caught: unknown) {
      if (mounted.current) setError(safeFailure(caught));
    } finally {
      busy.current = false;
      if (mounted.current) {
        setOperation('idle');
        if (pendingNotice.current) {
          pendingNotice.current = false;
          void restore(false);
        }
      }
    }
  }

  return {
    session,
    operation,
    error,
    success,
    restore,
    register: (input: RegisterRequest): Promise<void> =>
      run('register', async () => {
        const user = await authClient.register(input);
        if (mounted.current) {
          setSession({ status: 'authenticated', user });
          setSuccess(true);
        }
      }),
    login: (input: LoginRequest): Promise<void> =>
      run('local', async () => {
        const user = await authClient.login(input);
        if (mounted.current) {
          setSession({ status: 'authenticated', user });
          setSuccess(true);
        }
      }),
    google: (idToken: string): Promise<void> =>
      run('google', async () => {
        const user = await authClient.google({ idToken });
        if (mounted.current) {
          setSession({ status: 'authenticated', user });
          setSuccess(true);
        }
      }),
    logout: (): Promise<void> =>
      run('logout', async () => {
        await authClient.logout();
        if (mounted.current) {
          setSession({ status: 'unauthenticated' });
          setSuccess(false);
        }
      }),
  };
}
