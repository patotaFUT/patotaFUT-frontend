'use client';
import { GlobalAccessLoading } from '@/features/auth/components/global-access-loading';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/use-auth';
import { AppShell } from './app-shell';
import { eventContent as c } from '../events.content';
export function StatsScreen() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.session.status === 'unauthenticated') router.replace('/');
  }, [auth.session.status, router]);
  return (
    <AppShell
      title={c.statistics}
      section="stats"
      managing={false}
      organization={
        auth.session.status === 'authenticated' &&
        auth.session.user.role !== 'PLAYER'
      }
      onLogout={() => void auth.logout()}
      busy={auth.operation !== 'idle'}
    >
      <GlobalAccessLoading
        session={auth.session}
        onRetry={() => void auth.restore()}
      />
      <p role="status">
        {auth.session.status === 'authenticated'
          ? c.comingSoon
          : auth.session.status === 'error'
            ? auth.session.error.message
            : 'Verificando sessão...'}
      </p>
    </AppShell>
  );
}
