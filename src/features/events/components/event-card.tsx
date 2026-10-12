import Link from 'next/link';
import { FiCalendar, FiClock } from 'react-icons/fi';
import { FaUser } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import type { EventDto } from '../events.contracts';
import { eventContent as c, statusLabels } from '../events.content';
import styles from './events.module.css';
import { formatEventDate } from '../events.calendar';

export function EventCard({
  event,
  organizer,
  managing,
  busy,
  onPresence,
  onParticipants,
  onForm,
  onOwnTeam,
  teamsHref,
  manageHref,
  onNavigate,
}: {
  event: EventDto;
  organizer: boolean;
  managing: boolean;
  busy: boolean;
  onPresence: () => void;
  onParticipants: () => void;
  onForm: () => void;
  onOwnTeam?: (() => void) | undefined;
  teamsHref: string;
  manageHref: string;
  onNavigate: (path: string) => void;
}) {
  const presence = event.status === 'ACTIVE' && (
    <Button
      disabled={
        busy || (event.ownPresence === 'CONFIRMED' && event.ownAllocated)
      }
      className={`${styles.solid} ${event.ownPresence === 'CONFIRMED' ? styles.danger : styles.dark}`}
      onClick={onPresence}
    >
      {event.ownPresence === 'CONFIRMED' ? c.cancelPresence : c.presence}
    </Button>
  );
  return (
    <article
      className={`${styles.card} ${managing ? styles.managementCard : styles.eventCard}`}
      aria-label={event.name}
    >
      <h2>{event.name}</h2>
      {managing ? (
        <>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.outline}
              disabled={busy}
              onClick={onParticipants}
            >
              {c.participants}
            </button>
            {organizer && event.status === 'ACTIVE' && (
              <Button className={styles.solid} disabled={busy} onClick={onForm}>
                {c.form}
              </Button>
            )}
            <Link
              className={`${styles.solid} ${styles.highlight}`}
              href={teamsHref}
              onClick={(click) => {
                if (
                  !click.ctrlKey &&
                  !click.metaKey &&
                  !click.shiftKey &&
                  !click.altKey
                ) {
                  click.preventDefault();
                  onNavigate(`/org/events/${event.id}/teams`);
                }
              }}
            >
              {c.teams}
            </Link>
            {organizer && (
              <Link
                className={`${styles.solid} ${styles.warning}`}
                href={manageHref}
                onClick={(click) => {
                  if (
                    !click.ctrlKey &&
                    !click.metaKey &&
                    !click.shiftKey &&
                    !click.altKey
                  ) {
                    click.preventDefault();
                    onNavigate(`/org/events/${event.id}`);
                  }
                }}
              >
                Gerenciar
              </Link>
            )}
          </div>
          <div className={styles.statusBlock}>
            <span>{c.status}</span>
            <span className={styles.badge} data-status={event.status}>
              {statusLabels[event.status]}
            </span>
          </div>
          <p className={styles.confirmedCount}>
            {c.confirmed}: <strong>{event.confirmedCount}</strong>
          </p>
          {presence}
        </>
      ) : (
        <>
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
          <button
            type="button"
            className={styles.confirmedButton}
            disabled={busy}
            onClick={onParticipants}
            aria-label={`${c.participants}: ${event.confirmedCount}`}
          >
            <FaUser aria-hidden="true" />
            <span>
              {c.confirmed}: <strong>{event.confirmedCount}</strong>
            </span>
          </button>
          <div className={styles.actions}>
            {presence}
            {onOwnTeam ? (
              <button
                type="button"
                className={styles.outline}
                disabled={busy}
                onClick={onOwnTeam}
              >
                Ver time
              </button>
            ) : (
              <Link
                className={styles.outline}
                href={teamsHref}
                onClick={(click) => {
                  if (
                    !click.ctrlKey &&
                    !click.metaKey &&
                    !click.shiftKey &&
                    !click.altKey
                  ) {
                    click.preventDefault();
                    onNavigate(`/org/events/${event.id}/teams`);
                  }
                }}
              >
                Ver time
              </Link>
            )}
          </div>
          {event.status !== 'ACTIVE' && (
            <span className={styles.badge} data-status={event.status}>
              {statusLabels[event.status]}
            </span>
          )}
        </>
      )}
      {event.ownAllocated && <p className={styles.hint}>{c.allocated}</p>}
      {event.formationExists && (
        <p className={styles.hint}>
          {c.waiting}: {event.waitingCount}
        </p>
      )}
      {event.formationExists &&
        !event.ownAllocated &&
        event.ownPresence === 'CONFIRMED' && (
          <p className={styles.hint}>{c.ownWaiting}</p>
        )}
      {event.status === 'FINISHED' && (
        <p className={styles.hint}>{c.noStats}</p>
      )}
    </article>
  );
}
