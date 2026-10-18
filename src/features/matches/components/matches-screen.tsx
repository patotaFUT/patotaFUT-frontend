'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  FiChevronLeft,
  FiChevronRight,
  FiRefreshCw,
  FiSearch,
} from 'react-icons/fi';
import { GiWhistle } from 'react-icons/gi';
import { useAuth } from '@/features/auth/use-auth';
import { GlobalAccessLoading } from '@/features/auth/components/global-access-loading';
import { isRecord } from '@/features/auth/auth.contracts';
import { AppShell } from '@/features/events/components/app-shell';
import { Carousel } from '@/features/events/components/carousel';
import { Modal } from '@/features/events/components/modal';
import { eventsClient } from '@/features/events/browser-client';
import { EventRequestError } from '@/features/events/events.service';
import type { EventDetail, EventDto } from '@/features/events/events.contracts';
import {
  listMatches,
  loadMatch,
  matchRequest,
  parseMatch,
} from '../matches.service';
import type { Match, Goal } from '../matches.service';
import { MatchClock } from './match-clock';
import { MatchTeams } from './match-teams';
import { clockText } from '../match-clock';
import { CreateMatchForm, GoalForm } from './match-forms';
import common from '@/features/events/components/events.module.css';
import styles from './matches.module.css';

type Dialog =
  | { kind: 'create'; detail: EventDetail }
  | {
      kind: 'goal';
      ownGoal: boolean;
      goal?: Goal;
      scorerId?: string;
      teamId?: string;
    }
  | { kind: 'finish' | 'delete' };
export function MatchesScreen({
  eventId,
  matchId,
}: {
  eventId?: string;
  matchId?: string;
}) {
  const auth = useAuth(),
    router = useRouter();
  const authenticated = auth.session.status === 'authenticated';
  const allowed =
    auth.session.status === 'authenticated' &&
    auth.session.user.role !== 'PLAYER';
  const [events, setEvents] = useState<EventDto[]>([]),
    [matches, setMatches] = useState<Match[]>([]);
  const [match, setMatch] = useState<Match>();
  const [eventName, setEventName] = useState('');
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string>(),
    [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>(),
    [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>();
  const lock = useRef(false),
    generation = useRef(0);
  const restore = auth.restore;
  const title = matchId
    ? 'Gerenciar súmula'
    : eventId
      ? 'Súmulas ativas'
      : 'Súmulas';
  useEffect(() => {
    if (auth.session.status === 'unauthenticated') router.replace('/');
  }, [auth.session.status, router]);
  useEffect(() => {
    if (!allowed) return;
    const version = ++generation.current;
    setLoading(true);
    setMatch(undefined);
    void (async () => {
      if (eventId && matchId) {
        const result = await loadMatch(eventId, matchId);
        if (version === generation.current) setMatch(result);
      } else if (eventId) {
        const result = await listMatches(eventId);
        if (version === generation.current) setMatches(result);
      } else {
        const result = await eventsClient.list(cursor, query, 'ACTIVE');
        if (version === generation.current) {
          setEvents(result.items.filter((e) => e.status === 'ACTIVE'));
          setNext(result.nextCursor);
        }
      }
    })()
      .catch((caught: unknown) => {
        if (version !== generation.current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível carregar as súmulas.',
        );
        if (caught instanceof EventRequestError && caught.status === 401)
          void restore(false);
      })
      .finally(() => {
        if (version === generation.current) setLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [allowed, eventId, matchId, cursor, query, reload, restore]);

  async function run(operation: () => Promise<void>, keepDialog = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      if (!keepDialog) setDialog(undefined);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível concluir a operação.',
      );
      if (caught instanceof EventRequestError) {
        if (caught.status === 401) void restore(false);
        if ([0, 404, 409].includes(caught.status)) {
          setDialog(undefined);
          setReload((n) => n + 1);
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const path =
    eventId && matchId ? `/events/${eventId}/matches/${matchId}` : '';
  function action(actionPath: string, confirmed?: boolean) {
    if (!match) return;
    const current = match;
    void run(async () => {
      if (actionPath === 'start') {
        setMatch(
          await matchRequest(
            `${path}/start`,
            { revision: current.revision },
            parseMatch,
          ),
        );
      } else {
        await matchRequest(
          `${path}/${actionPath}`,
          {
            revision: current.revision,
            ...(confirmed ? { confirmed: true } : {}),
          },
          (v) => {
            if (!isRecord(v) || (v.finished !== true && v.deleted !== true))
              throw new Error('Resposta inválida');
            return true;
          },
        );
        setMatch(undefined);
        setMatches([]);
        router.replace(`/org/matches/${eventId}`);
      }
    });
  }
  const running = match?.status === 'IN_PROGRESS';
  return (
    <AppShell
      title={title}
      managing
      organization={allowed}
      backHref={
        allowed
          ? matchId
            ? `/org/matches/${eventId}`
            : eventId
              ? '/org/matches'
              : '/org'
          : undefined
      }
      busy={busy || auth.operation !== 'idle'}
      onLogout={() => void auth.logout()}
      titleAction={
        allowed ? (
          <button
            className={common.iconButton}
            aria-label="Atualizar súmulas"
            disabled={busy || loading}
            onClick={() => {
              setError(undefined);
              setReload((n) => n + 1);
            }}
          >
            <FiRefreshCw aria-hidden="true" />
          </button>
        ) : undefined
      }
    >
      <GlobalAccessLoading
        session={auth.session}
        onRetry={() => void auth.restore()}
      />
      {authenticated && !allowed && (
        <p role="alert">Permissão insuficiente para acessar esta página.</p>
      )}
      {allowed && (
        <div className={common.content}>
          {error && !dialog && (
            <p role="alert" className={common.error}>
              {error}
            </p>
          )}
          {loading && <p role="status">Carregando súmulas...</p>}
          {!eventId && (
            <>
              <form
                className={common.form}
                onSubmit={(e) => {
                  e.preventDefault();
                  setCursor(undefined);
                  setQuery(search.trim());
                  setReload((n) => n + 1);
                }}
              >
                <label className={common.field}>
                  <span className="visually-hidden">Nome do evento</span>
                  <span className={common.fieldBox}>
                    <input
                      type="search"
                      placeholder="Digite o nome do evento..."
                      maxLength={200}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <FiSearch aria-hidden="true" />
                  </span>
                </label>
                <button className={common.outline} disabled={loading || busy}>
                  Buscar
                </button>
              </form>
              {!loading && events.length === 0 && (
                <p>Nenhum evento ativo encontrado.</p>
              )}
              {!loading && events.length > 0 && (
                <Carousel count={events.length} label="Eventos para súmulas">
                  {events.map((event) => (
                    <article className={common.card} key={event.id}>
                      <h2>{event.name}</h2>
                      <button
                        className={`${common.solid} ${common.dark}`}
                        disabled={busy || !event.formationExists}
                        onClick={() =>
                          void run(async () => {
                            const detail = await eventsClient.detail(event.id);
                            const existing = await listMatches(event.id);
                            if (existing.length)
                              throw new EventRequestError(
                                409,
                                'Já existe uma súmula pendente ou em andamento. Acesse Súmulas ativas.',
                              );
                            setEventName(event.name);
                            setDialog({ kind: 'create', detail });
                          }, true)
                        }
                      >
                        Criar súmula
                      </button>
                      {!event.formationExists && (
                        <p>Forme os times antes de criar a súmula.</p>
                      )}
                      <Link
                        className={`${common.solid} ${common.warning}`}
                        href={`/org/matches/${event.id}`}
                      >
                        Súmulas ativas
                      </Link>
                      <span className={common.badge}>Ativo</span>
                      <p>
                        Total de Confirmados:{' '}
                        <strong>{event.confirmedCount}</strong>
                      </p>
                    </article>
                  ))}
                </Carousel>
              )}
              <nav className={common.toolbar} aria-label="Paginação de eventos">
                <button
                  className={common.iconButton}
                  aria-label="Primeira página de eventos"
                  disabled={!cursor || loading || busy}
                  onClick={() => setCursor(undefined)}
                >
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <button
                  className={common.iconButton}
                  aria-label="Próxima página de eventos"
                  disabled={!next || loading || busy}
                  onClick={() => {
                    if (next) setCursor(next);
                  }}
                >
                  <FiChevronRight aria-hidden="true" />
                </button>
              </nav>
            </>
          )}
          {eventId && !matchId && !loading && (
            <>
              {matches.length === 0 ? (
                <p>Nenhuma súmula pendente ou em andamento neste evento.</p>
              ) : (
                <Carousel count={matches.length} label="Súmulas ativas">
                  {matches.map((row) => (
                    <article className={common.card} key={row.id}>
                      <h2>
                        {row.teamA.name} × {row.teamB.name}
                      </h2>
                      <GiWhistle
                        className={styles.whistle}
                        aria-hidden="true"
                      />
                      <p>
                        {row.status === 'PENDING' ? 'Pendente' : 'Em andamento'}
                      </p>
                      <Link
                        className={`${common.solid} ${common.dark}`}
                        href={`/org/matches/${eventId}/${row.id}`}
                      >
                        Gerenciar
                      </Link>
                    </article>
                  ))}
                </Carousel>
              )}
            </>
          )}
          {match && !loading && (
            <>
              <section className={styles.score} aria-label="Placar da partida">
                <p>
                  Tempo de jogo:{' '}
                  {running && match.startedAt ? (
                    <MatchClock
                      startedAt={match.startedAt}
                      duration={match.durationMinutes}
                    />
                  ) : (
                    <strong aria-label="Tempo restante">
                      {clockText(match.durationMinutes * 60)}
                    </strong>
                  )}
                </p>
                <div className={styles.duel}>
                  <strong>{match.teamA.name}</strong>
                  <span>×</span>
                  <strong>{match.teamB.name}</strong>
                </div>
                <div className={styles.duel} aria-label="Placar">
                  <strong>{match.score.teamA}</strong>
                  <span>×</span>
                  <strong>{match.score.teamB}</strong>
                </div>
                <p>
                  {running
                    ? 'Em andamento'
                    : 'Pendente — a escalação será registrada ao iniciar.'}
                </p>
                {!running && (
                  <button
                    className={`${common.solid} ${common.dark} ${styles.action}`}
                    disabled={busy}
                    onClick={() => action('start')}
                  >
                    {busy ? 'Iniciando...' : 'Iniciar'}
                  </button>
                )}
              </section>
              <MatchTeams
                match={match}
                busy={busy}
                onGoal={(teamId, scorerId) => {
                  setError(undefined);
                  setDialog({ kind: 'goal', ownGoal: false, teamId, scorerId });
                }}
              />
              {running && (
                <>
                  <button
                    className={`${common.solid} ${common.warning} ${styles.action}`}
                    disabled={busy}
                    onClick={() => {
                      setError(undefined);
                      setDialog({ kind: 'goal', ownGoal: true });
                    }}
                  >
                    Gol contra
                  </button>
                  <section
                    className={common.card}
                    aria-label="Gols registrados"
                  >
                    <h2>Gols registrados</h2>
                    {match.goals.length === 0 && <p>Nenhum gol registrado.</p>}
                    {match.goals.map((g) => (
                      <div className={styles.record} key={g.id}>
                        <span>
                          {g.minute ?? '—'}′ —{' '}
                          {g.ownGoal
                            ? `Gol contra para ${g.teamId === match.teamA.id ? match.teamA.name : match.teamB.name}`
                            : [
                                ...match.teamA.players,
                                ...match.teamB.players,
                              ].find((p) => p.id === g.scorerParticipantId)
                                ?.name}
                          {g.assistParticipantId &&
                            ` · Assistência: ${[...match.teamA.players, ...match.teamB.players].find((p) => p.id === g.assistParticipantId)?.name}`}
                        </span>
                        <button
                          className={common.outline}
                          disabled={busy}
                          onClick={() => {
                            setError(undefined);
                            setDialog({
                              kind: 'goal',
                              ownGoal: g.ownGoal,
                              goal: g,
                            });
                          }}
                        >
                          Editar gol
                        </button>
                        <button
                          className={common.outline}
                          disabled={busy}
                          onClick={() =>
                            void run(async () =>
                              setMatch(
                                await matchRequest(
                                  `${path}/goals/${g.id}/delete`,
                                  { revision: match.revision },
                                  parseMatch,
                                ),
                              ),
                            )
                          }
                        >
                          Excluir gol
                        </button>
                      </div>
                    ))}
                  </section>
                  <button
                    className={`${common.solid} ${common.dark}`}
                    disabled={busy}
                    onClick={() => {
                      setError(undefined);
                      setDialog({ kind: 'finish' });
                    }}
                  >
                    Finalizar súmula
                  </button>
                </>
              )}
              {!running && (
                <button
                  className={`${common.solid} ${common.danger} ${styles.action}`}
                  disabled={busy}
                  onClick={() => {
                    setError(undefined);
                    setDialog({ kind: 'delete' });
                  }}
                >
                  Excluir súmula pendente
                </button>
              )}
            </>
          )}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === 'create'
              ? 'Criar súmula'
              : dialog.kind === 'goal'
                ? dialog.ownGoal
                  ? 'Gol contra'
                  : dialog.goal
                    ? 'Editar gol'
                    : 'Goool'
                : dialog.kind === 'finish'
                  ? 'Finalizar súmula'
                  : 'Excluir súmula pendente'
          }
          busy={busy}
          onClose={() => {
            if (!busy) setDialog(undefined);
          }}
        >
          {dialog.kind === 'create' && (
            <CreateMatchForm
              detail={dialog.detail}
              busy={busy}
              error={error}
              onSave={(data) =>
                void run(async () => {
                  const created = await matchRequest(
                    `/events/${dialog.detail.event.id}/matches`,
                    data,
                    parseMatch,
                  );
                  router.push(
                    `/org/matches/${dialog.detail.event.id}/${created.id}`,
                  );
                })
              }
            />
          )}
          {dialog.kind === 'goal' && match && (
            <GoalForm
              match={match}
              initial={dialog.goal}
              scorerId={dialog.scorerId}
              teamId={dialog.teamId}
              ownGoal={dialog.ownGoal}
              busy={busy}
              error={error}
              onSave={(data) =>
                void run(async () => {
                  setMatch(
                    await matchRequest(
                      `${path}/goals${dialog.goal ? `/${dialog.goal.id}/edit` : ''}`,
                      data,
                      parseMatch,
                    ),
                  );
                })
              }
            />
          )}
          {(dialog.kind === 'finish' || dialog.kind === 'delete') && (
            <div className={common.form}>
              <p>
                {dialog.kind === 'finish'
                  ? 'Tem certeza de que deseja finalizar esta súmula? Os registros não poderão ser editados nem acessados separadamente após a finalização.'
                  : 'Tem certeza de que deseja excluir esta súmula pendente?'}
              </p>
              {error && <p role="alert">{error}</p>}
              <button
                className={`${common.solid} ${common.dark}`}
                disabled={busy}
                onClick={() =>
                  action(
                    dialog.kind === 'finish' ? 'finish' : 'delete',
                    dialog.kind === 'finish',
                  )
                }
              >
                {busy
                  ? 'Aguarde...'
                  : dialog.kind === 'finish'
                    ? 'Confirmar finalização'
                    : 'Confirmar exclusão'}
              </button>
            </div>
          )}
          {dialog.kind === 'create' && <p>{eventName}</p>}
        </Modal>
      )}
    </AppShell>
  );
}
