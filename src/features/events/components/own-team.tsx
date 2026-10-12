import type { EventDetail } from '../events.contracts';
import { eventContent as c } from '../events.content';
import styles from './events.module.css';
export function ownGroup(detail: EventDetail | undefined) {
  const id = detail?.event.ownParticipantId;
  return id
    ? detail?.teams.find((team) =>
        team.members.some((member) => member.id === id),
      )
    : undefined;
}
export function OwnTeam({ detail }: { detail: EventDetail | undefined }) {
  if (!detail) return <p role="status">{c.loading}</p>;
  const group = ownGroup(detail);
  if (!group)
    return (
      <p>
        {detail.event.ownAllocated
          ? c.groupUnavailable
          : detail.event.formationExists &&
              detail.event.ownPresence === 'CONFIRMED'
            ? c.waiting
            : c.notAllocated}
      </p>
    );
  return (
    <ul className={styles.participantList}>
      {group.members.map((member) => (
        <li key={member.id}>
          <span>
            {member.name}
            {member.id === detail.event.ownParticipantId ? ` (${c.you})` : ''}
            {member.participantType === 'GUEST' ? ' (Convidado)' : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
