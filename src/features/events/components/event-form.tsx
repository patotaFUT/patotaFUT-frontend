'use client';
import { useState } from 'react';
import { FiCalendar, FiClock, FiEdit2 } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import type { EventInput } from '../events.contracts';
import styles from './events.module.css';
import { formatEventDate, parseDisplayDate } from '../events.calendar';
import { validateEvent } from '../events.validation';
import type { EventFieldErrors } from '../events.validation';
import { eventContent as c } from '../events.content';
export function EventForm({
  initial,
  busy,
  onSave,
}: {
  initial?: EventInput;
  busy: boolean;
  onSave: (input: EventInput) => Promise<boolean>;
}) {
  const [data, setData] = useState<EventInput>(
    initial ?? { name: '', date: '', startTime: '', endTime: '' },
  );
  const [displayDate, setDisplayDate] = useState(
    initial === undefined ? '' : formatEventDate(initial.date),
  );
  const [errors, setErrors] = useState<EventFieldErrors>({});
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const input = { ...data, date: parseDisplayDate(displayDate) ?? '' };
        const invalid = validateEvent(input);
        setErrors(invalid);
        const field = Object.keys(invalid)[0];
        if (field !== undefined) {
          const control = event.currentTarget.elements.namedItem(field);
          if (control instanceof HTMLElement) control.focus();
          return;
        }
        void onSave(input);
      }}
    >
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.formName}`}>
          <span className="visually-hidden">Nome do evento</span>
          <span className={styles.fieldBox}>
            <FiEdit2 aria-hidden="true" />
            <input
              name="name"
              placeholder="Digite o nome do evento..."
              required
              maxLength={200}
              value={data.name}
              onChange={(event) =>
                setData({ ...data, name: event.target.value })
              }
              disabled={busy}
              aria-invalid={errors.name !== undefined}
              aria-describedby={
                errors.name === undefined ? undefined : 'event-name-error'
              }
            />
          </span>
        </label>
        {errors.name !== undefined && (
          <p id="event-name-error" className={styles.error} role="alert">
            {errors.name}
          </p>
        )}
        <label className={styles.field}>
          Data (DD/MM/AAAA)
          <span className={styles.fieldBox}>
            <FiCalendar aria-hidden="true" />
            <input
              name="date"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              required
              value={displayDate}
              onChange={(event) => setDisplayDate(event.target.value)}
              disabled={busy}
              aria-invalid={errors.date !== undefined}
              aria-describedby={
                errors.date === undefined ? undefined : 'event-date-error'
              }
            />
          </span>
        </label>
        {errors.date !== undefined && (
          <p id="event-date-error" className={styles.error} role="alert">
            {errors.date}
          </p>
        )}
        <label className={styles.field}>
          Horário de início
          <span className={styles.fieldBox}>
            <FiClock aria-hidden="true" />
            <input
              name="startTime"
              type="time"
              required
              value={data.startTime}
              onChange={(event) =>
                setData({ ...data, startTime: event.target.value })
              }
              disabled={busy}
              aria-invalid={errors.startTime !== undefined}
              aria-describedby={
                errors.startTime === undefined ? undefined : 'event-start-error'
              }
            />
          </span>
        </label>
        {errors.startTime !== undefined && (
          <p id="event-start-error" className={styles.error} role="alert">
            {errors.startTime}
          </p>
        )}
        <label className={styles.field}>
          Horário de término
          <span className={styles.fieldBox}>
            <FiClock aria-hidden="true" />
            <input
              name="endTime"
              type="time"
              required
              value={data.endTime}
              onChange={(event) =>
                setData({ ...data, endTime: event.target.value })
              }
              disabled={busy}
              aria-invalid={errors.endTime !== undefined}
              aria-describedby={
                errors.endTime === undefined ? undefined : 'event-end-error'
              }
            />
          </span>
        </label>
        {errors.endTime !== undefined && (
          <p id="event-end-error" className={styles.error} role="alert">
            {errors.endTime}
          </p>
        )}
      </div>
      <p className={styles.hint}>{c.schedule}</p>
      <Button
        type="submit"
        className={`${styles.solid} ${styles.dark} ${styles.centerAction}`}
        disabled={busy}
      >
        {busy ? 'Salvando...' : 'Confirmar'}
      </Button>
    </form>
  );
}
