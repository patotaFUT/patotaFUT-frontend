'use client';
import { useState } from 'react';
import type { EventDetail } from '@/features/events/events.contracts';
import type { Match, Goal } from '../matches.service';
import { defaultGoalMinute } from '../match-clock';
import common from '@/features/events/components/events.module.css';
import styles from './matches.module.css';
import { isCompleteTeam } from '@/features/teams/team-formation';

export function CreateMatchForm({
  detail,
  busy,
  error,
  onSave,
}: {
  detail: EventDetail;
  busy: boolean;
  error: string | undefined;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [a, setA] = useState(''),
    [b, setB] = useState(''),
    [duration, setDuration] = useState('7');
  const teams = detail.teams.filter((t) =>
    isCompleteTeam(t, detail.event.playersPerTeam),
  );
  return (
    <form
      className={common.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          revision: detail.event.revision,
          teamAId: a,
          teamBId: b,
          durationMinutes: Number(duration),
        });
      }}
    >
      <div className={styles.duel}>
        <label className={common.field}>
          <span>Time A</span>
          <span className={common.fieldBox}>
            <select
              required
              value={a}
              onChange={(e) => setA(e.target.value)}
              disabled={busy}
            >
              <option value="">Time</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === b}>
                  {t.name}
                </option>
              ))}
            </select>
          </span>
        </label>
        <strong>×</strong>
        <label className={common.field}>
          <span>Time B</span>
          <span className={common.fieldBox}>
            <select
              required
              value={b}
              onChange={(e) => setB(e.target.value)}
              disabled={busy}
            >
              <option value="">Time</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === a}>
                  {t.name}
                </option>
              ))}
            </select>
          </span>
        </label>
      </div>
      <label className={common.field}>
        <span>Selecione o tempo de duração da partida</span>
        <span className={common.fieldBox}>
          <input
            aria-label="Duração em minutos"
            type="number"
            inputMode="numeric"
            min={3}
            step={1}
            required
            value={duration}
            disabled={busy}
            onChange={(e) => setDuration(e.target.value)}
          />
        </span>
      </label>
      <p>
        Mínimo de 3 minutos. O cronômetro começa ao pressionar Iniciar na
        súmula.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className={`${common.solid} ${common.dark}`} disabled={busy}>
        {busy ? 'Criando súmula...' : 'Criar súmula'}
      </button>
    </form>
  );
}

export function GoalForm({
  match,
  initial,
  ownGoal,
  scorerId,
  teamId,
  busy,
  error,
  onSave,
}: {
  match: Match;
  initial: Goal | undefined;
  ownGoal: boolean;
  scorerId: string | undefined;
  teamId: string | undefined;
  busy: boolean;
  error: string | undefined;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [team, setTeam] = useState(initial?.teamId ?? teamId ?? match.teamA.id);
  const [scorer, setScorer] = useState(
    initial?.scorerParticipantId ?? scorerId ?? '',
  );
  const [assist, setAssist] = useState(initial?.assistParticipantId ?? '');
  const [minute, setMinute] = useState(
    String(
      initial?.minute ??
        (match.startedAt
          ? defaultGoalMinute(
              match.startedAt,
              match.durationMinutes,
              Date.now(),
            )
          : 0),
    ),
  );
  const selected = team === match.teamA.id ? match.teamA : match.teamB;
  return (
    <form
      className={common.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          revision: match.revision,
          teamId: team,
          ownGoal,
          scorerParticipantId: ownGoal ? null : scorer,
          assistParticipantId: ownGoal || !assist ? null : assist,
          minute: Number(minute),
        });
      }}
    >
      <label className={common.field}>
        <span>{ownGoal ? 'Time que recebe o ponto' : 'Time do gol'}</span>
        <span className={common.fieldBox}>
          <select
            value={team}
            disabled={busy}
            onChange={(e) => {
              setTeam(e.target.value);
              setScorer('');
              setAssist('');
            }}
          >
            {[match.teamA, match.teamB].map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      {!ownGoal && (
        <>
          <label className={common.field}>
            <span>Autor do gol</span>
            <span className={common.fieldBox}>
              <select
                required
                value={scorer}
                disabled={busy}
                onChange={(e) => {
                  setScorer(e.target.value);
                  setAssist('');
                }}
              >
                <option value="">Selecione</option>
                {selected.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.participantType === 'GUEST' ? ' (Convidado)' : ''}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <p>Selecione um assistente para o gol, se houver.</p>
          <label className={common.field}>
            <span>Assistência</span>
            <span className={common.fieldBox}>
              <select
                value={assist}
                disabled={busy}
                onChange={(e) => setAssist(e.target.value)}
              >
                <option value="">Sem assistência</option>
                {selected.players
                  .filter((p) => p.id !== scorer)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </span>
          </label>
        </>
      )}
      <label className={common.field}>
        <span>Minuto do gol (tempo decorrido)</span>
        <span className={common.fieldBox}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            value={minute}
            disabled={busy}
            onChange={(e) => setMinute(e.target.value)}
          />
        </span>
      </label>
      <p>Após o cronômetro zerar, use minuto 0 para um novo gol.</p>
      {ownGoal && (
        <p>
          Gol contra altera somente o placar, sem gol ou assistência individual.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button className={`${common.solid} ${common.dark}`} disabled={busy}>
        {busy ? 'Salvando...' : 'Confirmar'}
      </button>
    </form>
  );
}
