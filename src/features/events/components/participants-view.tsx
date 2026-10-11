'use client';
import { useState } from 'react';
import { FiTrash2, FiChevronDown } from 'react-icons/fi';
import { FaUser } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import type { ParticipantPage } from '../events.contracts';
import { eventContent as c } from '../events.content';
import styles from './events.module.css';
export function ParticipantsView({
  page,
  organizer,
  active,
  busy,
  onMore,
  onGuest,
  onRemove,
}: {
  page: ParticipantPage | undefined;
  organizer: boolean;
  active: boolean;
  busy: boolean;
  onMore: () => void;
  onGuest: (name: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <>
      <p>
        {page === undefined
          ? 'Carregando confirmados...'
          : `${c.confirmed}: ${page.total}`}
      </p>
      {page !== undefined && (
        <>
          <ul className={styles.participantList}>
            {page.items.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name}
                  {p.participantType === 'GUEST' ? ' (Convidado)' : ''}
                  {p.allocated ? ' · Alocado' : ''}
                </span>
                {organizer && active && (
                  <button
                    type="button"
                    disabled={busy || p.allocated}
                    className={`${styles.iconButton} ${styles.removeButton}`}
                    aria-label={`Cancelar presença de ${p.name}`}
                    onClick={() => onRemove(p.id)}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {page.items.length === 0 && <p>Nenhuma presença confirmada.</p>}
          {page.nextCursor !== null && (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Carregar mais confirmados"
              disabled={busy}
              onClick={onMore}
            >
              <FiChevronDown aria-hidden="true" />
            </button>
          )}
        </>
      )}
      {organizer && active && (
        <form
          className={`${styles.form} ${styles.guestForm}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && name.trim() !== '')
              void onGuest(name).then((ok) => {
                if (ok) setName('');
              });
          }}
        >
          <label className={styles.field}>
            <span className="visually-hidden">{c.guest}</span>
            <span className={styles.fieldBox}>
              <FaUser aria-hidden="true" />
              <input
                name="guestName"
                placeholder="Nome do convidado..."
                required
                maxLength={200}
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
              />
            </span>
          </label>
          <Button
            type="submit"
            className={`${styles.solid} ${styles.dark} ${styles.centerAction}`}
            disabled={busy}
          >
            {c.add}
          </Button>
          <p className={styles.hint}>
            Convidados participam deste evento sem criar uma conta.
          </p>
          {page?.items.some((p) => p.allocated) && (
            <p className={styles.hint}>{c.removeAllocated}</p>
          )}
        </form>
      )}
    </>
  );
}
