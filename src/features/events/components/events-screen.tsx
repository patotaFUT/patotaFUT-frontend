'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiSearch,
  FiPlus,
  FiRefreshCw,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { TeamView } from '@/features/teams/components/team-view';
import { eventsClient } from '../browser-client';
import { EventRequestError } from '../events.service';
import type {
  EventDto,
  EventDetail,
  Page,
  ParticipantPage,
  EventStatus,
} from '../events.contracts';
import { eventContent as c } from '../events.content';
import { AppShell } from './app-shell';
import { Carousel } from './carousel';
import { EventCard } from './event-card';
import { Modal } from './modal';
import { EventForm } from './event-form';
import { FormationForm } from './formation-form';
import { ParticipantsView } from './participants-view';
import styles from './events.module.css';
import { EventOverview } from './event-overview';
type Dialog =
  | 'create'
  | 'edit'
  | 'participants'
  | 'formation'
  | 'finish'
  | 'remove';
export function EventsScreen({
  eventId,
  manageInitially = false,
}: {
  eventId?: string;
  manageInitially?: boolean;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [listManaging, setManaging] = useState(manageInitially);
  const managing = eventId === undefined ? listManaging : manageInitially;
  const [search, setSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const [filter, setFilter] = useState<EventStatus | undefined>();
  const [pages, setPages] = useState<Page<EventDto>>({
    items: [],
    nextCursor: null,
  });
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [detail, setDetail] = useState<EventDetail>();
  const [target, setTarget] = useState<EventDto>();
  const [participants, setParticipants] = useState<ParticipantPage>();
  const [dialog, setDialog] = useState<Dialog>();
  const [removeId, setRemoveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const organizer =
    auth.session.status === 'authenticated' &&
    auth.session.user.role === 'ORGANIZER';
  const admin =
    auth.session.status === 'authenticated' &&
    auth.session.user.role !== 'PLAYER';
  const authenticated = auth.session.status === 'authenticated';
  const loadRevision = useRef(0);
  useEffect(() => {
    if (error !== undefined) document.getElementById('event-error')?.focus();
  }, [error]);
  useEffect(() => {
    if (auth.session.status === 'unauthenticated') router.replace('/');
  }, [auth.session.status, router]);
  const load = useCallback(async () => {
    const version = ++loadRevision.current;
    setLoading(true);
    try {
      if (eventId !== undefined) {
        const result = await eventsClient.detail(eventId);
        if (version === loadRevision.current) setDetail(result);
      } else {
        const result = await eventsClient.list(
          cursors[pageIndex],
          querySearch,
          managing ? filter : 'ACTIVE',
        );
        if (version === loadRevision.current) setPages(result);
      }
    } catch (caught: unknown) {
      if (version === loadRevision.current) {
        setError(
          caught instanceof EventRequestError
            ? caught.message
            : c.communication,
        );
        if (caught instanceof EventRequestError && caught.status === 401)
          void auth.restore(false);
      }
    } finally {
      if (version === loadRevision.current) setLoading(false);
    }
  }, [
    eventId,
    cursors,
    pageIndex,
    querySearch,
    managing,
    filter,
    auth.restore,
  ]);
  useEffect(() => {
    if (authenticated) void load();
    return () => {
      loadRevision.current++;
    };
  }, [authenticated, load, reload]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible' && !lock.current)
        setReload((v) => v + 1);
    };
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, []);
  async function participantsPage(event: EventDto, append = false) {
    const page = await eventsClient.participants(
      event.id,
      append ? (participants?.nextCursor ?? undefined) : undefined,
    );
    if (page.revision !== event.revision) {
      const current = await eventsClient.detail(event.id);
      setTarget(current.event);
      if (eventId !== undefined) setDetail(current);
      setReload((v) => v + 1);
    }
    if (
      append &&
      participants !== undefined &&
      page.revision !== participants.revision
    ) {
      setParticipants(await eventsClient.participants(event.id));
      setError(c.conflict);
      return;
    }
    setParticipants(
      append && participants !== undefined
        ? { ...page, items: [...participants.items, ...page.items] }
        : page,
    );
  }
  async function open(kind: Dialog, event?: EventDto) {
    if (lock.current) return;
    setError(undefined);
    setTarget(event ?? detail?.event);
    setDialog(kind);
    setParticipants(undefined);
    if (kind === 'participants' && event !== undefined) {
      setBusy(true);
      lock.current = true;
      try {
        await participantsPage(event);
      } catch (caught: unknown) {
        setError(
          caught instanceof EventRequestError
            ? caught.message
            : c.communication,
        );
      } finally {
        setBusy(false);
        lock.current = false;
      }
    }
  }
  async function run(
    operation: () => Promise<EventDetail>,
    keepDialog = false,
    operationEventId?: string,
  ): Promise<boolean> {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await operation();
      if (eventId !== undefined) setDetail(result);
      setTarget(result.event);
      setPages((old) => ({
        ...old,
        items: old.items.map((event) =>
          event.id === result.event.id ? result.event : event,
        ),
      }));
      if (keepDialog) await participantsPage(result.event);
      else setDialog(undefined);
      setReload((v) => v + 1);
      return true;
    } catch (caught: unknown) {
      setError(
        caught instanceof EventRequestError ? caught.message : c.uncertain,
      );
      if (caught instanceof EventRequestError && caught.status === 401)
        void auth.restore(false);
      // Even uncertain responses may have committed. Refresh without replaying mutation.
      if (
        operationEventId !== undefined ||
        target !== undefined ||
        eventId !== undefined
      ) {
        const id = operationEventId ?? target?.id ?? eventId;
        if (id !== undefined)
          try {
            const current = await eventsClient.detail(id);
            setTarget(current.event);
            if (eventId !== undefined) setDetail(current);
            if (dialog === 'participants')
              await participantsPage(current.event);
          } catch {
            /* Keep the original safe error. */
          }
      }
      setReload((v) => v + 1);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const selected = target ?? detail?.event;
  function action(
    event: EventDto,
    path: string,
    payload: Record<string, unknown> = {},
    keep = false,
  ) {
    return run(
      () => eventsClient.action(event.id, path, event.revision, payload),
      keep,
      event.id,
    );
  }
  const title =
    eventId !== undefined
      ? managing
        ? c.manage
        : c.teams
      : managing
        ? c.title
        : c.activeTitle;
  if (!authenticated)
    return (
      <AppShell
        title={title}
        managing={false}
        onLogout={() => void auth.logout()}
        busy={auth.operation !== 'idle'}
      >
        <p className={styles.notice} role="status">
          {auth.session.status === 'error'
            ? auth.session.error.message
            : 'Verificando sessão...'}
        </p>
        {auth.session.status === 'error' && (
          <Button onClick={() => void auth.restore()}>Tentar novamente</Button>
        )}
      </AppShell>
    );
  return (
    <AppShell
      title={title}
      managing={managing}
      onMode={
        admin
          ? (value) => {
              if (eventId !== undefined) {
                router.push(value ? `/events/${eventId}?manage=1` : '/events');
                return;
              }
              setManaging(value);
              setPageIndex(0);
              setCursors([undefined]);
            }
          : undefined
      }
      onLogout={() => void auth.logout()}
      busy={busy || auth.operation !== 'idle'}
    >
      <div className={styles.content}>
        {error !== undefined && dialog === undefined && (
          <p
            id="event-error"
            tabIndex={-1}
            className={`${styles.notice} ${styles.error}`}
            role="alert"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          className={`${styles.iconButton} ${styles.refresh}`}
          aria-label={c.retry}
          title={c.retry}
          disabled={busy || loading}
          onClick={() => {
            setError(undefined);
            setReload((v) => v + 1);
          }}
        >
          <FiRefreshCw aria-hidden="true" />
        </button>
        {eventId === undefined ? (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setQuerySearch(search);
                setPageIndex(0);
                setCursors([undefined]);
                setReload((v) => v + 1);
              }}
              className={styles.form}
            >
              <label className={styles.field}>
                <span className="visually-hidden">
                  Buscar eventos pelo nome
                </span>
                <span className={styles.fieldBox}>
                  <input
                    name="search"
                    placeholder={c.search}
                    maxLength={200}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                    }}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    aria-label="Buscar eventos"
                    className={styles.iconButton}
                  >
                    <FiSearch aria-hidden="true" />
                  </button>
                </span>
              </label>
            </form>
            {managing && (
              <label className={styles.field}>
                <span className="visually-hidden">Estado do evento</span>
                <span className={styles.fieldBox}>
                  <select
                    value={filter ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilter(
                        value === 'ACTIVE' ||
                          value === 'CANCELED' ||
                          value === 'FINISHED'
                          ? value
                          : undefined,
                      );
                      setPageIndex(0);
                      setCursors([undefined]);
                    }}
                  >
                    <option value="">Todos</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="CANCELED">Cancelados</option>
                    <option value="FINISHED">Finalizados</option>
                  </select>
                </span>
              </label>
            )}
            {organizer && managing && (
              <Button
                className={`${styles.solid} ${styles.dark} ${styles.centerAction}`}
                disabled={busy}
                onClick={() => void open('create')}
              >
                <FiPlus aria-hidden="true" />
                {c.create}
              </Button>
            )}
            {loading ? (
              <p role="status">{c.loading}</p>
            ) : pages.items.length === 0 ? (
              <p>{c.empty}</p>
            ) : (
              <Carousel
                key={`${pageIndex}-${querySearch}-${filter}-${managing}`}
                count={pages.items.length}
                label={title}
              >
                {pages.items.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    organizer={organizer}
                    managing={managing}
                    busy={busy}
                    onParticipants={() => void open('participants', event)}
                    onForm={() => void open('formation', event)}
                    onPresence={() => {
                      setTarget(event);
                      void action(event, 'presence', {
                        status:
                          event.ownPresence === 'CONFIRMED'
                            ? 'CANCELED'
                            : 'CONFIRMED',
                      });
                    }}
                  />
                ))}
              </Carousel>
            )}
            <nav className={styles.toolbar} aria-label={c.pagination}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={c.previousPage}
                disabled={busy || loading || pageIndex === 0}
                onClick={() => setPageIndex((v) => v - 1)}
              >
                <FiChevronsLeft aria-hidden="true" />
              </button>
              <span aria-live="polite">Página {pageIndex + 1}</span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={c.nextPage}
                disabled={busy || loading || pages.nextCursor === null}
                onClick={() => {
                  const next = pages.nextCursor;
                  if (next !== null) {
                    setCursors((old) => [...old.slice(0, pageIndex + 1), next]);
                    setPageIndex((v) => v + 1);
                  }
                }}
              >
                <FiChevronsRight aria-hidden="true" />
              </button>
            </nav>
          </>
        ) : loading && detail === undefined ? (
          <p role="status">{c.loading}</p>
        ) : detail !== undefined ? (
          <>
            {managing ? (
              <>
                <EventOverview
                  event={detail.event}
                  organizer={organizer}
                  busy={busy}
                  formed={detail.teams.length > 0}
                  onParticipants={() => void open('participants', detail.event)}
                  onPresence={() =>
                    void action(detail.event, 'presence', {
                      status:
                        detail.event.ownPresence === 'CONFIRMED'
                          ? 'CANCELED'
                          : 'CONFIRMED',
                    })
                  }
                  onEdit={() => void open('edit', detail.event)}
                  onForm={() => void open('formation', detail.event)}
                  onFinish={() => void open('finish', detail.event)}
                  onCancel={() =>
                    void action(detail.event, 'status', { status: 'CANCELED' })
                  }
                  onResume={() =>
                    void action(detail.event, 'status', { status: 'ACTIVE' })
                  }
                />
                <Link
                  className={`${styles.outline} ${styles.backLink}`}
                  href={`/events/${detail.event.id}`}
                >
                  {c.teams}
                </Link>
              </>
            ) : (
              <TeamView
                key={`${detail.event.id}-${detail.event.revision}`}
                teams={detail.teams}
                editable={admin && detail.event.status === 'ACTIVE'}
                busy={busy}
                onSwap={(first, second) =>
                  action(detail.event, 'teams/swap', {
                    firstTeamId: first.teamId,
                    secondTeamId: second.teamId,
                    firstParticipantId: first.participantId,
                    secondParticipantId: second.participantId,
                  })
                }
              />
            )}
            <Link
              className={`${styles.outline} ${styles.backLink}`}
              href="/events"
            >
              {c.back}
            </Link>
          </>
        ) : null}
        {dialog !== undefined && (
          <Modal
            title={
              dialog === 'create'
                ? c.create
                : dialog === 'edit'
                  ? 'Editar evento'
                  : dialog === 'participants'
                    ? c.participants
                    : dialog === 'formation'
                      ? c.form
                      : dialog === 'finish'
                        ? 'Finalizar evento'
                        : 'Cancelar presença'
            }
            busy={busy}
            onClose={() => setDialog(undefined)}
          >
            {error !== undefined && (
              <p
                id="event-error"
                tabIndex={-1}
                className={styles.error}
                role="alert"
              >
                {error}
              </p>
            )}
            {dialog === 'create' && (
              <EventForm
                busy={busy}
                onSave={(input) => run(() => eventsClient.create(input))}
              />
            )}
            {dialog === 'edit' && selected !== undefined && (
              <EventForm
                initial={{
                  name: selected.name,
                  date: selected.date,
                  startTime: selected.startTime,
                  endTime: selected.endTime,
                }}
                busy={busy}
                onSave={(input) =>
                  run(() =>
                    eventsClient.edit(selected.id, selected.revision, input),
                  )
                }
              />
            )}
            {dialog === 'formation' && selected !== undefined && (
              <FormationForm
                count={selected.confirmedCount}
                busy={busy}
                onForm={(playersPerTeam) =>
                  action(selected, 'formation', { playersPerTeam })
                }
              />
            )}
            {dialog === 'participants' && selected !== undefined && (
              <ParticipantsView
                page={participants}
                organizer={organizer}
                active={selected.status === 'ACTIVE'}
                busy={busy}
                onMore={() => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  void participantsPage(selected, true)
                    .catch(() => setError(c.communication))
                    .finally(() => {
                      lock.current = false;
                      setBusy(false);
                    });
                }}
                onGuest={(name) => action(selected, 'guests', { name }, true)}
                onRemove={(id) => {
                  setRemoveId(id);
                  setDialog('remove');
                }}
              />
            )}
            {dialog === 'finish' && selected !== undefined && (
              <>
                <p>{c.finishConfirm}</p>
                <p className={styles.hint}>{c.noStats}</p>
                <Button
                  className={`${styles.solid} ${styles.highlight} ${styles.centerAction}`}
                  disabled={busy}
                  onClick={() =>
                    void action(selected, 'status', {
                      status: 'FINISHED',
                      confirmed: true,
                    })
                  }
                >
                  Confirmar finalização
                </Button>
              </>
            )}
            {dialog === 'remove' &&
              selected !== undefined &&
              removeId !== undefined && (
                <>
                  <p>Cancelar a presença deste participante no evento?</p>
                  <Button
                    disabled={busy}
                    className={`${styles.solid} ${styles.danger}`}
                    onClick={() =>
                      void action(selected, `participants/${removeId}/cancel`)
                    }
                  >
                    Confirmar cancelamento
                  </Button>
                </>
              )}
          </Modal>
        )}
      </div>
    </AppShell>
  );
}
