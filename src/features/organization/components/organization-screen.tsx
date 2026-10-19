'use client';
import { PreferencesPanel } from '@/features/account/components/preferences-panel';
import { MembersPanel } from '@/features/account/components/members-panel';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiLogOut, FiSliders } from 'react-icons/fi';
import { GiSoccerField, GiSoccerKick, GiWhistle } from 'react-icons/gi';
import { useAuth } from '@/features/auth/use-auth';
import { GlobalAccessLoading } from '@/features/auth/components/global-access-loading';
import { AppShell } from '@/features/events/components/app-shell';
import {
  organizationAccesses,
  canOpenOrganizationPage,
} from '../organization.access';
import type {
  OrganizationAccess,
  OrganizationPage,
} from '../organization.access';
import styles from './organization.module.css';

const icons = {
  events: GiSoccerField,
  matches: GiWhistle,
  members: GiSoccerKick,
  preferences: FiSliders,
};
function AccessIcon({ kind }: { kind: OrganizationAccess }) {
  const Icon = icons[kind];
  return (
    <span
      className={`${styles.icon} ${kind === 'preferences' ? styles.preferencesIcon : ''}`}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}

export function OrganizationScreen({
  page = 'home',
}: {
  page?: OrganizationPage;
}) {
  const auth = useAuth(),
    router = useRouter();
  const [roleNotice, setRoleNotice] = useState('');
  const busy = auth.operation !== 'idle';
  const title =
    page === 'home'
      ? 'Gerenciamento'
      : page === 'members'
        ? 'Integrantes'
        : 'Preferências';
  useEffect(() => {
    if (auth.session.status === 'unauthenticated') router.replace('/');
  }, [auth.session.status, router]);
  const role =
    auth.session.status === 'authenticated'
      ? auth.session.user.role
      : undefined;
  const allowed = role !== undefined && canOpenOrganizationPage(role, page);
  return (
    <AppShell
      title={title}
      titleClassName={page === 'home' ? styles.title : undefined}
      backHref={role !== undefined && page !== 'home' ? '/org' : undefined}
      managing={true}
      organization={role !== undefined}
      onLogout={() => void auth.logout()}
      busy={busy}
    >
      <GlobalAccessLoading
        session={auth.session}
        onRetry={() => void auth.restore()}
      />
      {roleNotice && <p role="status">{roleNotice}</p>}
      {role === undefined ? (
        <p className={styles.notice} role="status">
          {auth.session.status === 'error'
            ? auth.session.error.message
            : 'Verificando sessão...'}
        </p>
      ) : !allowed ? (
        <div className={styles.placeholder}>
          <p role="status">Você não tem permissão para acessar esta área.</p>
        </div>
      ) : page === 'preferences' && auth.session.status === 'authenticated' ? (
        <PreferencesPanel
          user={auth.session.user}
          refresh={() => auth.restore(false, true)}
        />
      ) : page === 'members' && auth.session.status === 'authenticated' ? (
        <MembersPanel
          ownId={auth.session.user.id}
          onOwnRoleChanged={() =>
            setRoleNotice(
              'Sua função foi atualizada. As permissões da nova função já estão em vigor; use Voltar para acessar a central.',
            )
          }
          refresh={() => auth.restore(false, true)}
        />
      ) : (
        <nav className={styles.hub} aria-label="Acessos de gerenciamento">
          <ul className={styles.grid}>
            {organizationAccesses(role).map((access) => (
              <li key={access.id}>
                <Link
                  href={access.href}
                  className={`${styles.card} ${styles[access.id]}`}
                  aria-disabled={busy || undefined}
                  tabIndex={busy ? -1 : undefined}
                  onClick={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  <AccessIcon kind={access.id} />
                  <span>{access.title}</span>
                </Link>
              </li>
            ))}
            <li className={styles.logoutItem}>
              <button
                type="button"
                className={`${styles.card} ${styles.logout}`}
                disabled={busy}
                onClick={() => void auth.logout()}
              >
                <span className={styles.icon}>
                  <FiLogOut aria-hidden="true" />
                </span>
                <span>Sair da Conta</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </AppShell>
  );
}
