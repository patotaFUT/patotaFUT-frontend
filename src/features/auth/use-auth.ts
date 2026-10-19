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
  const restoring = useRef<Promise<void> | undefined>();
  const blockingRestore = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const restore = useCallback(
    (renew = true, background = false): Promise<void> => {
      if (!background) {
        blockingRestore.current = true;
        setSession({ status: 'checking' });
      }
      if (restoring.current !== undefined) return restoring.current;
      blockingRestore.current = !background;
      const current = ++revision.current;
      const pending = authClient
        .restore(renew)
        .then((result) => {
          if (mounted.current && revision.current === current) {
            // A secondary visibility probe must not cover an already usable screen.
            if (blockingRestore.current || result.status !== 'error')
              setSession(result);
            setSuccess(false);
          }
        })
        .finally(() => {
          if (restoring.current === pending) restoring.current = undefined;
        });
      restoring.current = pending;
      return pending;
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    // AuthClient deduplicates the actual request across Strict Mode remounts.
    restoring.current = undefined;
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
      if (
        document.visibilityState === 'visible' &&
        !busy.current &&
        sessionRef.current.status !== 'error' &&
        sessionRef.current.status !== 'checking'
      )
        void restore(true, true);
    };
    document.addEventListener('visibilitychange', onVisible);
    // Reuse /auth/me to reflect role changes from another device while this tab stays open.
    const permissionProbe = setInterval(onVisible, 30000);
    return (): void => {
      mounted.current = false;
      revision.current++;
      unsubscribe?.();
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(permissionProbe);
    };
  }, [restore]);

  async function run(
    kind: Exclude<AuthOperation, 'idle'>,
    action: () => Promise<void>,
  ): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    revision.current++;
    restoring.current = undefined;
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
