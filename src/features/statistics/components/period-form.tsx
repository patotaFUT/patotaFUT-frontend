'use client';
import { useState } from 'react';
import { FiCalendar } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/features/events/components/date-input';
import {
  formatEventDate,
  parseDisplayDate,
} from '@/features/events/events.calendar';
import type { Period } from '../statistics.contracts';
import common from '@/features/events/components/events.module.css';
export function PeriodForm({
  initial,
  onSave,
}: {
  initial: Period;
  onSave: (period: Period) => void;
}) {
  const [from, setFrom] = useState(formatEventDate(initial.from));
  const [to, setTo] = useState(formatEventDate(initial.to));
  const [error, setError] = useState<string>();
  return (
    <form
      className={common.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const start = parseDisplayDate(from),
          end = parseDisplayDate(to);
        if (!start || !end || start > end) {
          setError(
            !start || !end
              ? 'Informe duas datas completas e existentes.'
              : 'A data final deve ser igual ou posterior à data inicial.',
          );
          const control = event.currentTarget.elements.namedItem(
            !start ? 'from' : 'to',
          );
          if (control instanceof HTMLElement) control.focus();
          return;
        }
        onSave({ from: start, to: end });
      }}
    >
      <label className={common.field}>
        Data inicial (DD/MM/AAAA)
        <span className={common.fieldBox}>
          <FiCalendar aria-hidden="true" />
          <DateInput
            name="from"
            value={from}
            placeholder="DD/MM/AAAA"
            onChange={(value) => {
              setFrom(value);
              setError(undefined);
            }}
            required
            aria-invalid={error !== undefined}
            aria-describedby={error ? 'period-error' : undefined}
          />
        </span>
      </label>
      <label className={common.field}>
        Data final (DD/MM/AAAA)
        <span className={common.fieldBox}>
          <FiCalendar aria-hidden="true" />
          <DateInput
            name="to"
            value={to}
            placeholder="DD/MM/AAAA"
            onChange={(value) => {
              setTo(value);
              setError(undefined);
            }}
            required
            aria-invalid={error !== undefined}
            aria-describedby={error ? 'period-error' : undefined}
          />
        </span>
      </label>
      {error && (
        <p id="period-error" role="alert" className={common.error}>
          {error}
        </p>
      )}
      <Button
        type="submit"
        className={`${common.solid} ${common.centerAction}`}
      >
        Aplicar período
      </Button>
    </form>
  );
}
