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
export interface SwapSelection {
  teamId: string;
  participantId: string;
}
export function TeamView({
  teams,
  editable,
  busy,
  onSwap,
}: {
  teams: TeamDto[];
  editable: boolean;
  busy: boolean;
  onSwap: (first: SwapSelection, second: SwapSelection) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<TeamDto>();
  const [selected, setSelected] = useState<SwapSelection[]>([]);
  function choose(teamId: string, participantId: string) {
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
                disabled={busy}
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
            <span className={teamStyles.badge} data-type={team.type}>
              {team.type === 'RESERVES' ? 'Incompleto' : 'Completo'}
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
              onClick={() => setViewing(team)}
            >
              {c.players}
            </Button>
            {editable && (
              <Button
                className={`${styles.solid} ${styles.warning}`}
                disabled={busy}
                onClick={() => {
                  setEditing(true);
                  setSelected([]);
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
    <section className={styles.section} aria-label={c.teams}>
      {teams.length === 0 ? (
        <p className={styles.emptyTeams}>{c.missingTeams}</p>
      ) : (
        <>
          {editing && (
            <div className={teamStyles.editHeading}>
              <h2>{c.editingTeams}</h2>
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
            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.outline}
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setSelected([]);
                }}
              >
                {c.back}
              </button>
              <Button
                className={`${styles.solid} ${styles.dark}`}
                disabled={busy || !valid}
                onClick={() => {
                  if (first !== undefined && second !== undefined && valid)
                    void onSwap(first, second).then((ok) => {
                      if (ok) setSelected([]);
                    });
                }}
              >
                Confirmar troca
              </Button>
            </div>
          )}
        </>
      )}
      {viewing !== undefined && (
        <Modal
          title={viewing.name}
          busy={busy}
          onClose={() => setViewing(undefined)}
        >
          {members(viewing, false)}
        </Modal>
      )}
    </section>
  );
}
