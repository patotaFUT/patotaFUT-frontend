'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formationError } from '../events.validation';
import styles from './events.module.css';
export function FormationForm({
  count,
  busy,
  onForm,
}: {
  count: number;
  busy: boolean;
  onForm: (size: number) => Promise<boolean>;
}) {
  const [size, setSize] = useState('');
  const [error, setError] = useState<string>();
  return (
    <form
      className={`${styles.form} ${styles.formationForm}`}
      onSubmit={(event) => {
        event.preventDefault();
        const number = Number(size);
        const invalid = formationError(number, count);
        setError(invalid);
        if (invalid === undefined && !busy) void onForm(number);
      }}
    >
      <p>{count} participantes confirmados</p>
      <label className={styles.field}>
        Quantos jogadores por time?
        <span className={styles.fieldBox}>
          <input
            name="playersPerTeam"
            type="number"
            inputMode="numeric"
            required
            min={1}
            step={1}
            value={size}
            aria-invalid={error !== undefined}
            aria-describedby={
              error === undefined ? undefined : 'formation-error'
            }
            onChange={(event) => {
              setSize(event.target.value);
              setError(undefined);
            }}
            disabled={busy}
          />
        </span>
      </label>
      {error !== undefined && (
        <p id="formation-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.hint}>
        Todos os times completos serão formados. As sobras ficarão nas reservas.
        Um novo sorteio substitui a formação atual.
      </p>
      <Button
        type="submit"
        className={`${styles.solid} ${styles.dark} ${styles.centerAction}`}
        disabled={busy}
      >
        {busy ? 'Formando...' : 'Sortear'}
      </Button>
    </form>
  );
}
