'use client';

import { useLayoutEffect, useRef } from 'react';
import { IoFootball } from 'react-icons/io5';
import { Button } from '@/components/ui/button';
import type { SessionState } from '../auth.contracts';
import styles from './global-access-loading.module.css';

export function GlobalAccessLoading({
  session,
  onRetry,
}: {
  session: SessionState;
  onRetry: () => void;
}) {
  return (
    <>
      {(session.status === 'checking' || session.status === 'error') && (
        <AccessOverlay
          failure={
            session.status === 'error' ? session.error.message : undefined
          }
          onRetry={onRetry}
        />
      )}
    </>
  );
}

function AccessOverlay({
  failure,
  onRetry,
}: {
  failure: string | undefined;
  onRetry: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    // The browser's top layer covers the entire shell and makes siblings inert,
    // even when this component is mounted inside a scrollable screen.
    node?.showModal();
    node?.focus();
    return () => {
      node?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  useLayoutEffect(() => {
    if (failure !== undefined) dialog.current?.querySelector('button')?.focus();
    else dialog.current?.focus();
  }, [failure]);
  return (
    <dialog
      ref={dialog}
      className={styles.overlay}
      tabIndex={-1}
      aria-label={
        failure === undefined ? 'carregando' : 'Falha ao preparar o acesso'
      }
      aria-modal="true"
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles.content}>
        <IoFootball
          aria-hidden="true"
          className={[
            styles.ball,
            failure === undefined ? styles.animated : '',
          ].join(' ')}
        />
        {failure === undefined ? (
          <p role="status" className={styles.label}>
            carregando
          </p>
        ) : (
          <>
            <p role="alert">Não foi possível preparar o acesso à aplicação.</p>
            <p>{failure}</p>
            <Button onClick={onRetry}>Tentar novamente</Button>
          </>
        )}
      </div>
    </dialog>
  );
}
