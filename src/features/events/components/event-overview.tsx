import { FiCalendar, FiClock, FiEdit2 } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import type { EventDto } from '../events.contracts';
import { eventContent as c, statusLabels } from '../events.content';
import { formatEventDate } from '../events.calendar';
import styles from './events.module.css';

export function EventOverview({
  event,
  organizer,
  busy,
  formed,
  onParticipants,
  onPresence,
  onEdit,
  onForm,
  onFinish,
  onCancel,
  onResume,
}: {
  event: EventDto;
  organizer: boolean;
  busy: boolean;
  formed: boolean;
  onParticipants: () => void;
  onPresence: () => void;
  onEdit: () => void;
  onForm: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onResume: () => void;
}) {
  return (
    <>
      <article className={`${styles.card} ${styles.overviewCard}`}>
        <div className={styles.overviewHeading}>
          <h2>{event.name}</h2>
          {organizer && event.status !== 'FINISHED' && (
            <button
              type="button"
              className={styles.editData}
              disabled={busy}
              onClick={onEdit}
            >
              <FiEdit2 aria-hidden="true" />
              <span>{c.edit}</span>
            </button>
          )}
        </div>
        <div className={styles.facts}>
          <p className={styles.fact}>
            <FiCalendar aria-hidden="true" />
            <span>Data: {formatEventDate(event.date)}</span>
          </p>
          <p className={styles.fact}>
            <FiClock aria-hidden="true" />
            <span>Início: {event.startTime}</span>
          </p>
          <p className={styles.fact}>
            <FiClock aria-hidden="true" />
            <span>Fim: {event.endTime}</span>
          </p>
        </div>
        <div className={styles.statusBlock}>
          <span>{c.status}</span>
          <span className={styles.badge} data-status={event.status}>
            {statusLabels[event.status]}
          </span>
        </div>
        {organizer && event.status === 'ACTIVE' && (
          <div className={styles.actionRow}>
            <Button
              className={`${styles.solid} ${styles.highlight}`}
              disabled={busy}
              onClick={onFinish}
            >
              {c.finish}
            </Button>
            <Button
              variant="danger"
              className={styles.control}
              disabled={busy}
              onClick={onCancel}
            >
              Cancelar
            </Button>
          </div>
        )}
        {organizer && event.status === 'CANCELED' && (
          <div className={styles.actions}>
            <Button
              className={`${styles.solid} ${styles.information} ${styles.centerAction}`}
              disabled={busy}
              onClick={onResume}
            >
              {c.resume}
            </Button>
            <Button
              className={`${styles.solid} ${styles.highlight} ${styles.centerAction}`}
              disabled={busy}
              onClick={onFinish}
            >
              {c.finish}
            </Button>
          </div>
        )}
        {event.status === 'FINISHED' && (
          <p className={styles.hint}>{c.noStats}</p>
        )}
      </article>
      <section
        className={styles.eventParticipation}
        aria-label="Participação no evento"
      >
        <button
          type="button"
          className={styles.confirmedButton}
          disabled={busy}
          onClick={onParticipants}
        >
          <span>
            {c.confirmed}: <strong>{event.confirmedCount}</strong>
          </span>
          <span className={styles.hint}>{c.participants}</span>
        </button>
        {event.status === 'ACTIVE' && (
          <Button
            variant={event.ownPresence === 'CONFIRMED' ? 'danger' : 'primary'}
            className={
              event.ownPresence === 'CONFIRMED'
                ? styles.control
                : `${styles.solid} ${styles.dark}`
            }
            disabled={
              busy || (event.ownPresence === 'CONFIRMED' && event.ownAllocated)
            }
            onClick={onPresence}
          >
            {event.ownPresence === 'CONFIRMED' ? c.cancelPresence : c.presence}
          </Button>
        )}
        {event.ownAllocated && <p className={styles.hint}>{c.allocated}</p>}
        {organizer && event.status === 'ACTIVE' && (
          <Button className={styles.solid} disabled={busy} onClick={onForm}>
            {formed ? c.reform : c.form}
          </Button>
        )}
      </section>
    </>
  );
}
