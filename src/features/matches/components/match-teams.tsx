import { GiSoccerBall } from 'react-icons/gi';
import { Carousel } from '@/features/events/components/carousel';
import type { Match } from '../matches.service';
import common from '@/features/events/components/events.module.css';
import styles from './matches.module.css';

export function MatchTeams({
  match,
  busy,
  onGoal,
}: {
  match: Match;
  busy: boolean;
  onGoal: (teamId: string, scorerId: string) => void;
}) {
  return (
    <Carousel count={2} label="Times da partida" pairOnDesktop>
      {[match.teamA, match.teamB].map((team) => (
        <section key={team.id} className={common.card} aria-label={team.name}>
          <h2>{team.name}</h2>
          <p>{team.players.length} jogadores</p>
          <ul className={styles.players}>
            {team.players.map((player) => (
              <li className={styles.player} key={player.id}>
                <span className={styles.playerName}>
                  {player.name}
                  {player.participantType === 'GUEST' ? ' (Convidado)' : ''}
                </span>
                <span className={styles.playerGoals}>
                  <span>
                    {
                      match.goals.filter(
                        (goal) =>
                          !goal.ownGoal &&
                          goal.scorerParticipantId === player.id,
                      ).length
                    }{' '}
                    gols
                  </span>
                  <button
                    className={common.iconButton}
                    aria-label={`Registrar gol de ${player.name}`}
                    disabled={match.status !== 'IN_PROGRESS' || busy}
                    onClick={() => onGoal(team.id, player.id)}
                  >
                    <GiSoccerBall aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Carousel>
  );
}
