'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { FaUsers } from 'react-icons/fa';
import { Modal } from '@/features/events/components/modal';
import teamStyles from './team-view.module.css';
import type { TeamDto } from '@/features/events/events.contracts';
import { eventContent as c } from '@/features/events/events.content';
import { Carousel } from '@/features/events/components/carousel';
import styles from '@/features/events/components/events.module.css';
import { isCompleteTeam } from '../team-formation';
export interface SwapSelection {
  teamId: string;
  participantId: string;
}
export function TeamView({
  teams,
  editable,
  busy,
  onSwap,
  editing = false,
  onEdit,
  waitingParticipants = [],
  capacity,
  onAllocate,
}: {
  teams: TeamDto[];
  editable: boolean;
  busy: boolean;
  onSwap: (first: SwapSelection, second: SwapSelection) => Promise<boolean>;
  editing?: boolean;
  onEdit: () => void;
  waitingParticipants?: import('@/features/events/events.contracts').ParticipantDto[];
  capacity?: number | null;
  onAllocate: (participantId: string, teamId: string) => Promise<boolean>;
}) {
  const [success, setSuccess] = useState<string>();
  const [waitingId, setWaitingId] = useState('');
  const [destination, setDestination] = useState('');
  const [viewingId, setViewingId] = useState<string>();
  const viewing = teams.find((team) => team.id === viewingId);
  const [selected, setSelected] = useState<SwapSelection[]>([]);
  function choose(teamId: string, participantId: string) {
    setSuccess(undefined);
    setSelected((items) =>
      items.some((item) => item.participantId === participantId)
        ? items.filter((item) => item.participantId !== participantId)
        : items.length < 2
          ? [...items, { teamId, participantId }]
          : items,
    );
  }
  const first = selected[0];
  const second = selected[1];
  const valid =
    first !== undefined &&
    second !== undefined &&
    first.teamId !== second.teamId &&
    !(
      teams.find((t) => t.id === first.teamId)?.type === 'RESERVES' &&
      teams.find((t) => t.id === second.teamId)?.type === 'RESERVES'
    );
  function members(team: TeamDto, selecting: boolean) {
    return (
      <ul className={`${styles.participantList} ${teamStyles.members}`}>
        {team.members.map((member) => (
          <li key={member.id}>
            <span>
              {member.name}
              {member.participantType === 'GUEST' ? ' (Convidado)' : ''}
            </span>
            {selecting && (
              <button
                type="button"
                className={styles.selectButton}
                aria-pressed={selected.some(
                  (s) => s.participantId === member.id,
                )}
                disabled={busy || !editable}
                onClick={() => choose(team.id, member.id)}
              >
                {selected.some((s) => s.participantId === member.id)
                  ? 'Selecionado'
                  : 'Selecionar'}
              </button>
            )}
          </li>
        ))}
      </ul>
    );
  }
  const cards = teams.map((team) => (
    <article
      key={team.id}
      className={`${styles.card} ${teamStyles.card}`}
      aria-label={team.name}
    >
      {editing ? (
        <>
          <div className={teamStyles.heading}>
            <div>
              <h2>{team.name}</h2>
              <p>{team.members.length} jogadores</p>
            </div>
            <span
              className={teamStyles.badge}
              data-type={isCompleteTeam(team, capacity) ? 'TEAM' : 'RESERVES'}
            >
              {isCompleteTeam(team, capacity) ? 'Completo' : 'Incompleto'}
            </span>
          </div>
          {members(team, true)}
        </>
      ) : (
        <>
          <h2>{team.name}</h2>
          <div className={teamStyles.jersey} aria-hidden="true">
            {team.type === 'RESERVES' ? (
              <FaUsers />
            ) : (
              <>
                <Image src="/team-jersey.svg" width={500} height={483} alt="" />
                <span>{team.name.match(/\d+$/)?.[0] ?? ''}</span>
              </>
            )}
          </div>
          <div
            className={`${styles.actionRow} ${!editable ? teamStyles.singleAction : ''}`}
          >
            <Button
              className={`${styles.solid} ${styles.dark}`}
              disabled={busy}
              onClick={() => setViewingId(team.id)}
            >
              {c.players}
            </Button>
            {editable && (
              <Button
                className={`${styles.solid} ${styles.warning}`}
                disabled={busy}
                onClick={() => {
                  onEdit();
                }}
              >
                {c.edit}
              </Button>
            )}
          </div>
        </>
      )}
    </article>
  ));
  return (
    <section
      className={styles.section}
      aria-label={editing ? c.editingTeams : c.teams}
    >
      {teams.length === 0 ? (
        <p className={styles.emptyTeams}>{c.missingTeams}</p>
      ) : (
        <>
          {editing && (
            <div className={teamStyles.editHeading}>
              <p>{c.swap}</p>
            </div>
          )}
          {editing ? (
            <div className={styles.teamStack}>{cards}</div>
          ) : (
            <Carousel label={c.teams} count={teams.length}>
              {cards}
            </Carousel>
          )}
          {editing && (
            <div className={teamStyles.swapAction}>
              <Button
                className={`${styles.solid} ${styles.dark}`}
                disabled={busy || !editable || !valid}
                onClick={() => {
                  if (first !== undefined && second !== undefined && valid)
                    void onSwap(first, second).then((ok) => {
                      if (ok) {
                        setSelected([]);
                        setSuccess(c.swapSuccess);
                      }
                    });
                }}
              >
                Confirmar troca
              </Button>
            </div>
          )}
        </>
      )}
      {success && (
        <p role="status" className={styles.hint}>
          {success}
        </p>
      )}
      {editing && editable && waitingParticipants.length > 0 && (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && waitingId && destination)
              void onAllocate(waitingId, destination).then((ok) => {
                if (ok) {
                  setWaitingId('');
                  setDestination('');
                  setSuccess(c.allocatedSuccess);
                }
              });
          }}
        >
          <h2>
            {c.waiting}: {waitingParticipants.length}
          </h2>
          <label className={styles.field}>
            {c.participant}
            <span className={styles.fieldBox}>
              <select
                value={waitingId}
                disabled={busy}
                onChange={(e) => setWaitingId(e.target.value)}
                required
              >
                <option value="">{c.choose}</option>
                {waitingParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.participantType === 'GUEST' ? ' (Convidado)' : ''}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <label className={styles.field}>
            {c.teamWithVacancy}
            <span className={styles.fieldBox}>
              <select
                value={destination}
                disabled={busy}
                onChange={(e) => setDestination(e.target.value)}
                required
              >
                <option value="">{c.choose}</option>
                {teams
                  .filter(
                    (team) =>
                      team.type === 'TEAM' &&
                      capacity != null &&
                      team.members.length < capacity,
                  )
                  .map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
              </select>
            </span>
          </label>
          <Button
            className={`${styles.solid} ${styles.dark}`}
            type="submit"
            disabled={busy || !waitingId || !destination}
          >
            {c.allocate}
          </Button>
        </form>
      )}
      {viewing !== undefined && (
        <Modal
          title={viewing.name}
          busy={busy}
          onClose={() => setViewingId(undefined)}
        >
          {members(viewing, false)}
        </Modal>
      )}
    </section>
  );
}
