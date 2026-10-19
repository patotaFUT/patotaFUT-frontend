'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/features/events/components/modal';
import { accountRequest } from '../account.service';
import { parseMembers } from '../account.contracts';
import type { Member, MemberPage } from '../account.contracts';
import styles from './account.module.css';
export function MembersPanel({
  ownId,
  refresh,
}: {
  ownId: string;
  refresh: () => Promise<void>;
}) {
  const [page, setPage] = useState<MemberPage>(),
    [target, setTarget] = useState<Member>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const pending = useRef(false);
  async function load(cursor?: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const next = parseMembers(
        await accountRequest(
          `members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        ),
      );
      setPage((previous) =>
        cursor && previous
          ? {
              items: [...previous.items, ...next.items],
              nextCursor: next.nextCursor,
            }
          : next,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Falha ao carregar integrantes.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function remove() {
    if (!target || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await accountRequest(`members/${target.id}/delete`, { confirmed: true });
      if (target.id === ownId) await refresh();
      setPage((previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.filter((item) => item.id !== target.id),
            }
          : previous,
      );
      setTarget(undefined);
      setMessage('Conta removida.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível remover a conta.',
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.content} aria-busy={busy}>
      {message && <p role="status">{message}</p>}
      {busy && !target && <p role="status">Carregando integrantes...</p>}
      {error && !target && <p role="alert">{error}</p>}
      {!page && !busy && (
        <Button onClick={() => void load()}>Tentar novamente</Button>
      )}
      <ul className={styles.list}>
        {page?.items.map((member) => (
          <li key={member.id} className={`${styles.section} ${styles.member}`}>
            <span>
              <strong>
                {member.firstName} {member.lastName}
              </strong>
              <br />
              {member.email}
            </span>
            <Button
              className={styles.danger}
              disabled={busy}
              onClick={() => {
                setError('');
                setTarget(member);
              }}
            >
              Excluir conta
            </Button>
          </li>
        ))}
      </ul>
      {page?.nextCursor && (
        <Button
          disabled={busy}
          onClick={() => void load(page.nextCursor ?? undefined)}
        >
          Carregar mais integrantes
        </Button>
      )}
      {target && (
        <Modal
          title="Remover integrante"
          busy={busy}
          onClose={() => setTarget(undefined)}
        >
          <p>
            Excluir a conta de{' '}
            <strong>
              {target.firstName} {target.lastName}
            </strong>{' '}
            ({target.email})? A pessoa perderá o acesso, seus dados pessoais
            serão removidos e deixará de aparecer nos rankings. Esta ação não
            pode ser desfeita.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button disabled={busy} onClick={() => setTarget(undefined)}>
              Cancelar
            </Button>
            <Button
              className={styles.danger}
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Excluindo...' : 'Excluir conta'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
