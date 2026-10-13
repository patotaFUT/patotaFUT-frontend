'use client';
import Image from 'next/image';
import Link from 'next/link';
import { FiBarChart2, FiLogOut } from 'react-icons/fi';
import { HiHome, HiViewGridAdd } from 'react-icons/hi';
import type { ReactNode } from 'react';
import styles from './events.module.css';
import { eventContent as c } from '../events.content';
export function AppShell({
  children,
  title,
  managing,
  organization,
  onLogout,
  busy,
  section,
}: {
  children: ReactNode;
  title: string;
  managing: boolean;
  organization?: boolean;
  section?: string;
  onLogout: () => void;
  busy: boolean;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Image
          src="/patotafut-logo.png"
          width={60}
          height={75}
          alt="PatotaFUT"
          priority
        />
        <button
          type="button"
          disabled={busy}
          className={styles.iconButton}
          aria-label="Sair da conta"
          onClick={onLogout}
        >
          <FiLogOut aria-hidden="true" />
        </button>
      </header>
      <main
        id="events-main"
        className={styles.main}
        tabIndex={0}
        aria-label={title}
      >
        <h1 className={styles.pageTitle}>{title}</h1>
        {children}
      </main>
      <nav className={styles.menu} aria-label="Menu principal">
        <Link
          href="/stats"
          aria-current={section === 'stats' ? 'page' : undefined}
        >
          <FiBarChart2 aria-hidden="true" />
          <span>{c.statistics}</span>
        </Link>
        <Link
          href="/events"
          aria-label="Eventos ativos"
          aria-current={!managing && section !== 'stats' ? 'page' : undefined}
        >
          <HiHome aria-hidden="true" />
          <span>Eventos</span>
        </Link>
        {organization && (
          <Link href="/org/events" aria-current={managing ? 'page' : undefined}>
            <HiViewGridAdd aria-hidden="true" />
            <span>Gerenciar</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
