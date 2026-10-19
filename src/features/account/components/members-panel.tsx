'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/features/events/components/modal';
import { roleLabels } from '@/features/auth/auth.content';
import type { UserRole } from '@/features/auth/auth.contracts';
import { accountRequest, AccountRequestError } from '../account.service';
import { isMemberRole, parseMembers, parseMember } from '../account.contracts';
import type { Member, MemberPage } from '../account.contracts';
import styles from './account.module.css';

type MemberDialog =
  | { kind: 'delete'; member: Member }
  | { kind: 'role'; member: Member; next: UserRole };
const roles: UserRole[] = ['PLAYER', 'ADMIN', 'ORGANIZER'];
const name = (member: Member) => `${member.firstName} ${member.lastName}`;
async function readPage(cursor?: string): Promise<MemberPage> {
  return parseMembers(
    await accountRequest(
      `members${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  );
}
export function MembersPanel({
  ownId,
  refresh,
  onOwnRoleChanged,
}: {
  ownId: string;
  refresh: () => Promise<void>;
  onOwnRoleChanged: () => void;
}) {
  const [page, setPage] = useState<MemberPage>(),
    [dialog, setDialog] = useState<MemberDialog>();
  const [drafts, setDrafts] = useState<Record<string, UserRole>>({});
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
      const next = await readPage(cursor);
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
      if (caught instanceof AccountRequestError && caught.status === 403)
        await refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function confirm() {
    if (!dialog || pending.current) return;
    const action = dialog;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (action.kind === 'delete') {
        await accountRequest(`members/${action.member.id}/delete`, {
          confirmed: true,
        });
        setPage((previous) =>
          previous
            ? {
                ...previous,
                items: previous.items.filter(
                  (item) => item.id !== action.member.id,
                ),
              }
            : previous,
        );
        if (action.member.id === ownId) await refresh();
        setMessage('Conta removida.');
      } else {
        const response = await accountRequest(
          `members/${action.member.id}/role`,
          {
            confirmed: true,
            role: action.next,
            expectedRole: action.member.role,
          },
        );
        const member = parseMember(response.member);
        setPage((previous) =>
          previous
            ? {
                ...previous,
                items: previous.items.map((item) =>
                  item.id === member.id ? member : item,
                ),
              }
            : previous,
        );
        setDrafts((previous) => {
          const next = { ...previous };
          delete next[member.id];
          return next;
        });
        setMessage(
          `Função de ${name(member)} alterada para ${roleLabels[member.role]}.`,
        );
        if (member.id === ownId) onOwnRoleChanged();
        await refresh();
      }
      setDialog(undefined);
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught.message : 'Não foi possível concluir.';
      if (
        caught instanceof AccountRequestError &&
        caught.status === 409 &&
        action.kind === 'role'
      ) {
        // A fresh list requires a new explicit confirmation; never replay a role change.
        try {
          setPage(await readPage());
          setDrafts({});
          setDialog(undefined);
        } catch {
          /* Preserve the original conflict; no mutation is retried. */
        }
      }
      setError(failure);
      if (caught instanceof AccountRequestError && caught.status === 403)
        await refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={styles.content} aria-busy={busy}>
      {message && <p role="status">{message}</p>}
      {busy && !dialog && <p role="status">Carregando integrantes...</p>}
      {error && !dialog && <p role="alert">{error}</p>}
      {(!page || error !== '') && !busy && !dialog && (
        <Button onClick={() => void load()}>Tentar novamente</Button>
      )}
      <ul className={styles.list}>
        {page?.items.map((member) => {
          const next = drafts[member.id] ?? member.role;
          return (
            <li
              key={member.id}
              className={`${styles.section} ${styles.member}`}
            >
              <div>
                <strong>{name(member)}</strong>
                <p>Função atual: {roleLabels[member.role]}</p>
              </div>
              <div className={styles.memberControls}>
                <label htmlFor={`role-${member.id}`}>Nova função</label>
                <div className={styles.roleField}>
                  <select
                    id={`role-${member.id}`}
                    aria-label={`Nova função de ${name(member)}`}
                    value={next}
                    disabled={busy}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isMemberRole(value))
                        setDrafts((previous) => ({
                          ...previous,
                          [member.id]: value,
                        }));
                    }}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  disabled={busy || next === member.role}
                  aria-label={`Alterar função de ${name(member)}`}
                  onClick={() => {
                    setError('');
                    setMessage('');
                    setDialog({ kind: 'role', member, next });
                  }}
                >
                  Alterar função
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  aria-label={`Excluir conta de ${name(member)}`}
                  onClick={() => {
                    setError('');
                    setMessage('');
                    setDialog({ kind: 'delete', member });
                  }}
                >
                  Excluir conta
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {page?.nextCursor && (
        <Button
          disabled={busy}
          onClick={() => void load(page.nextCursor ?? undefined)}
        >
          Carregar mais integrantes
        </Button>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === 'role' ? 'Alterar função' : 'Remover integrante'
          }
          busy={busy}
          onClose={() => setDialog(undefined)}
        >
          {dialog.kind === 'role' ? (
            <>
              <p>
                Alterar a função de <strong>{name(dialog.member)}</strong> de{' '}
                <strong>{roleLabels[dialog.member.role]}</strong> para{' '}
                <strong>{roleLabels[dialog.next]}</strong>?
              </p>
              {dialog.member.id === ownId && (
                <p>
                  Suas permissões de gestão passarão a seguir a nova função
                  imediatamente.
                </p>
              )}
            </>
          ) : (
            <p>
              Excluir a conta de <strong>{name(dialog.member)}</strong>? A
              pessoa perderá o acesso, seus dados pessoais serão removidos e
              deixará de aparecer nos rankings. Esta ação não pode ser desfeita.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className={styles.actions}>
            <Button disabled={busy} onClick={() => setDialog(undefined)}>
              Cancelar
            </Button>
            <Button
              variant={dialog.kind === 'delete' ? 'danger' : 'primary'}
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy
                ? dialog.kind === 'delete'
                  ? 'Excluindo...'
                  : 'Salvando...'
                : dialog.kind === 'delete'
                  ? 'Excluir conta'
                  : 'Confirmar alteração'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
