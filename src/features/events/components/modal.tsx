'use client';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import styles from './events.module.css';
export function Modal({
  title,
  children,
  onClose,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.modal}
      aria-labelledby="event-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className={styles.modalHeader}>
        <h2 id="event-modal-title">{title}</h2>
        <button
          type="button"
          disabled={busy}
          aria-label="Fechar"
          className={styles.iconButton}
          onClick={onClose}
        >
          <FiX aria-hidden="true" />
        </button>
      </div>
      <div className={styles.modalBody}>{children}</div>
    </dialog>
  );
}
