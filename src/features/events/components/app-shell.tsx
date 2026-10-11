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
  onMode,
  onLogout,
  busy,
}: {
  children: ReactNode;
  title: string;
  managing: boolean;
  onMode?: ((value: boolean) => void) | undefined;
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
        <h1>{title}</h1>
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
        {children}
      </main>
      <nav className={styles.menu} aria-label="Menu principal">
        <button
          type="button"
          disabled
          aria-label={c.statisticsUnavailable}
          title={c.statisticsUnavailable}
        >
          <FiBarChart2 aria-hidden="true" />
          <span>{c.statistics}</span>
        </button>
        <Link
          href="/events"
          aria-label="Eventos ativos"
          aria-current={!managing ? 'page' : undefined}
          onClick={() => onMode?.(false)}
        >
          <HiHome aria-hidden="true" />
          <span>Eventos</span>
        </Link>
        {onMode !== undefined && (
          <button
            type="button"
            disabled={busy}
            aria-pressed={managing}
            onClick={() => onMode(true)}
          >
            <HiViewGridAdd aria-hidden="true" />
            <span>Gerenciar</span>
          </button>
        )}
      </nav>
    </div>
  );
}
