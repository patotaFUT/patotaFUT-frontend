'use client';
import { GlobalAccessLoading } from '@/features/auth/components/global-access-loading';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { eventBackHref, safeReturn, withReturn } from '../navigation';
import { OwnTeam, ownGroup } from './own-team';
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
import { EventHighlights } from '@/features/statistics/components/event-highlights';
type Dialog =
  | 'create'
  | 'edit'
  | 'participants'
  | 'formation'
  | 'finish'
  | 'remove'
  | 'ownTeam';
export function EventsScreen({
  eventId,
  area = 'events',
  view = 'teams',
}: {
  eventId?: string;
  area?: 'events' | 'organization';
  view?: 'manage' | 'teams' | 'editTeams';
}) {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const managing = area === 'organization';
  const base = managing ? '/org/events' : '/events';
  const [search, setSearch] = useState(params.get('q')?.slice(0, 200) ?? '');
  const [querySearch, setQuerySearch] = useState(search);
  const initialStatus = params.get('status');
  const [filter, setFilter] = useState<EventStatus | undefined>(
    initialStatus === 'ACTIVE' ||
      initialStatus === 'CANCELED' ||
      initialStatus === 'FINISHED'
      ? initialStatus
      : undefined,
  );
  const [ownDetail, setOwnDetail] = useState<EventDetail>();
  const scrollPosition = useRef(0);
  const [slide, setSlide] = useState(0);
  const restored = useRef(false);
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
  const [success, setSuccess] = useState<string>();
  const organizer =
    auth.session.status === 'authenticated' &&
    auth.session.user.role === 'ORGANIZER';
  const admin =
    auth.session.status === 'authenticated' &&
    auth.session.user.role !== 'PLAYER';
  const authenticated = auth.session.status === 'authenticated';
  const allowed =
    !managing ||
    (admin && (eventId === undefined || view !== 'manage' || organizer));
  const loadRevision = useRef(0);
  function origin() {
    const query = new URLSearchParams();
    if (querySearch) query.set('q', querySearch);
    if (filter && managing) query.set('status', filter);
    cursors.slice(1, pageIndex + 1).forEach((cursor) => {
      if (cursor) query.append('after', cursor);
    });
    query.set('page', String(pageIndex));
    query.set('slide', String(slide));
    query.set(
      'scroll',
      String(
        (typeof document === 'undefined'
          ? 0
          : document.getElementById('events-main')?.scrollTop) ??
          scrollPosition.current,
      ),
    );
    return `${base}?${query}`;
  }
  useEffect(() => {
    if (eventId !== undefined) return;
    const after = params
      .getAll('after')
      .filter((value) => /^[a-f\d]{24}$/i.test(value));
    const index = Math.min(
      after.length,
      Math.max(0, Math.floor(Number(params.get('page')) || 0)),
    );
    setCursors((old) =>
      old.join() === [undefined, ...after].join() ? old : [undefined, ...after],
    );
    setPageIndex(index);
    setSearch(params.get('q')?.slice(0, 200) ?? '');
    setQuerySearch(params.get('q')?.slice(0, 200) ?? '');
    const status = params.get('status');
    setFilter(
      status === 'ACTIVE' || status === 'CANCELED' || status === 'FINISHED'
        ? status
        : undefined,
    );
    setSlide(
      Math.min(
        1000000,
        Math.max(0, Math.floor(Number(params.get('slide')) || 0)),
      ),
    );
    scrollPosition.current = Math.max(0, Number(params.get('scroll')) || 0);
    restored.current = false;
  }, [params, eventId]);
  useEffect(() => {
    if (!loading && !restored.current && eventId === undefined) {
      const main = document.getElementById('events-main');
      if (main) main.scrollTop = scrollPosition.current;
      restored.current = true;
    }
  }, [loading, eventId]);
  function updateListing(
    q: string,
    status: EventStatus | undefined,
    after: (string | undefined)[],
    index: number,
  ) {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (status && managing) query.set('status', status);
    after.slice(1, index + 1).forEach((cursor) => {
      if (cursor) query.append('after', cursor);
    });
    query.set('page', String(index));
    router.replace(`${base}?${query}`, { scroll: false });
  }
  useEffect(() => {
    if (error !== undefined) document.getElementById('event-error')?.focus();
  }, [error]);
  useEffect(() => {
    if (auth.session.status === 'unauthenticated') router.replace('/');
  }, [auth.session.status, router]);
  useEffect(() => {
    if (authenticated && admin && !managing && eventId !== undefined) {
      router.replace(
        withReturn(
          `/org/events/${eventId}/teams`,
          safeReturn(params.get('returnTo'), '/org/events'),
        ),
      );
    }
  }, [authenticated, admin, managing, eventId, params, router]);
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
    if (authenticated && allowed) void load();
    return () => {
      loadRevision.current++;
    };
  }, [authenticated, allowed, load, reload]);
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
    setOwnDetail(undefined);
    if (
      (kind === 'participants' || kind === 'ownTeam') &&
      event !== undefined
    ) {
      setBusy(true);
      lock.current = true;
      try {
        if (kind === 'ownTeam')
          setOwnDetail(await eventsClient.detail(event.id));
        else await participantsPage(event);
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
    setSuccess(undefined);
    const main = document.getElementById('events-main');
    const previousScroll = main?.scrollTop ?? 0;
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
      if (eventId === undefined) setReload((v) => v + 1);
      requestAnimationFrame(() => {
        if (main) main.scrollTop = previousScroll;
      });
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
      ? view === 'editTeams'
        ? c.editingTeams
        : view === 'manage'
          ? c.manage
          : c.teams
      : managing
        ? c.organization
        : c.activeTitle;
  if (!authenticated)
    return (
      <AppShell
        title={title}
        managing={false}
        onLogout={() => void auth.logout()}
        busy={auth.operation !== 'idle'}
      >
        <GlobalAccessLoading
          session={auth.session}
          onRetry={() => void auth.restore()}
        />
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
      organization={admin}
      backHref={
        allowed
          ? eventBackHref({
              eventId,
              managing,
              view,
              organizer,
              returnTo: params.get('returnTo'),
            })
          : undefined
      }
      backDisabled={view === 'editTeams' && busy}
      onLogout={() => void auth.logout()}
      busy={busy || auth.operation !== 'idle'}
      titleAction={
        allowed ? (
          <button
            type="button"
            className={styles.iconButton}
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
        ) : undefined
      }
    >
      <GlobalAccessLoading
        session={auth.session}
        onRetry={() => void auth.restore()}
      />
      <div className={styles.content}>
        {!allowed ? (
          <p role="status">{c.forbidden}</p>
        ) : (
          <>
            {success && (
              <p className={styles.hint} role="status">
                {success}
              </p>
            )}
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
            {eventId === undefined ? (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateListing(search, filter, [undefined], 0);
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
                          updateListing(
                            querySearch,
                            value === 'ACTIVE' ||
                              value === 'CANCELED' ||
                              value === 'FINISHED'
                              ? value
                              : undefined,
                            [undefined],
                            0,
                          );
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
                    initialIndex={slide}
                    onActiveChange={setSlide}
                  >
                    {pages.items.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        organizer={organizer}
                        managing={managing}
                        busy={busy}
                        onNavigate={(path) => {
                          const returnPath = origin();
                          window.history.replaceState(
                            window.history.state,
                            '',
                            returnPath,
                          );
                          router.push(withReturn(path, returnPath));
                        }}
                        teamsHref={withReturn(
                          `/org/events/${event.id}/teams`,
                          origin(),
                        )}
                        manageHref={withReturn(
                          `/org/events/${event.id}`,
                          origin(),
                        )}
                        onOwnTeam={
                          !admin ? () => void open('ownTeam', event) : undefined
                        }
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
                    onClick={() =>
                      updateListing(querySearch, filter, cursors, pageIndex - 1)
                    }
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
                        updateListing(
                          querySearch,
                          filter,
                          [...cursors.slice(0, pageIndex + 1), next],
                          pageIndex + 1,
                        );
                        setCursors((old) => [
                          ...old.slice(0, pageIndex + 1),
                          next,
                        ]);
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
                {view === 'manage' ? (
                  <>
                    <EventOverview
                      event={detail.event}
                      organizer={organizer}
                      busy={busy}
                      formed={detail.teams.length > 0}
                      onParticipants={() =>
                        void open('participants', detail.event)
                      }
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
                        void action(detail.event, 'status', {
                          status: 'CANCELED',
                        })
                      }
                      onResume={() =>
                        void action(detail.event, 'status', {
                          status: 'ACTIVE',
                        })
                      }
                    />
                    <Link
                      className={`${styles.outline} ${styles.backLink}`}
                      href={withReturn(
                        `/org/events/${detail.event.id}/teams`,
                        withReturn(
                          `/org/events/${detail.event.id}`,
                          safeReturn(params.get('returnTo'), '/org/events'),
                        ),
                      )}
                    >
                      {c.teams}
                    </Link>
                  </>
                ) : (
                  <TeamView
                    key={detail.event.id}
                    editing={view === 'editTeams'}
                    onEdit={() =>
                      router.push(
                        withReturn(
                          `/org/events/${detail.event.id}/teams/edit`,
                          safeReturn(params.get('returnTo'), '/org/events'),
                        ),
                      )
                    }
                    waitingParticipants={detail.waitingParticipants}
                    capacity={detail.event.playersPerTeam}
                    onAllocate={(participantId, teamId) =>
                      action(detail.event, 'teams/allocate', {
                        participantId,
                        teamId,
                      })
                    }
                    teams={detail.teams}
                    editable={
                      managing && admin && detail.event.status === 'ACTIVE'
                    }
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
                {detail.event.status === 'ACTIVE' &&
                  detail.teams.length > 0 &&
                  view !== 'editTeams' && (
                    <div className={styles.section}>
                      <p>
                        {c.waiting}: {detail.event.waitingCount}
                      </p>
                      {organizer && (
                        <Button
                          className={`${styles.solid} ${styles.dark} ${styles.centerAction}`}
                          disabled={busy}
                          onClick={() =>
                            void action(detail.event, 'teams/incorporate').then(
                              (ok) => {
                                if (ok) setSuccess(c.incorporateSuccess);
                              },
                            )
                          }
                        >
                          {c.incorporate}
                        </Button>
                      )}
                      <p className={styles.hint}>{c.futureMatches}</p>
                    </div>
                  )}
              </>
            ) : null}
            {dialog !== undefined && (
              <Modal
                title={
                  dialog === 'ownTeam'
                    ? ownGroup(ownDetail)?.type === 'RESERVES'
                      ? 'Reservas'
                      : (ownGroup(ownDetail)?.name ?? c.ownTeam)
                    : dialog === 'create'
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
                onClose={() => {
                  setDialog(undefined);
                  setError(undefined);
                  setParticipants(undefined);
                  setOwnDetail(undefined);
                }}
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
                {dialog === 'ownTeam' && <OwnTeam detail={ownDetail} />}
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
                        eventsClient.edit(
                          selected.id,
                          selected.revision,
                          input,
                        ),
                      )
                    }
                  />
                )}
                {dialog === 'formation' && selected !== undefined && (
                  <FormationForm
                    count={selected.confirmedCount}
                    formed={selected.formationExists}
                    busy={busy}
                    onForm={(playersPerTeam) =>
                      action(selected, 'formation', {
                        playersPerTeam,
                        ...(selected.formationExists
                          ? { confirmed: true }
                          : {}),
                      })
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
                    onGuest={(name) =>
                      action(selected, 'guests', { name }, true)
                    }
                    onRemove={(id) => {
                      setError(undefined);
                      setRemoveId(id);
                      setDialog('remove');
                    }}
                  />
                )}
                {dialog === 'finish' && selected !== undefined && (
                  <EventHighlights
                    eventId={selected.id}
                    revision={selected.revision}
                    busy={busy}
                    onConfirm={(revision) =>
                      void action({ ...selected, revision }, 'status', {
                        status: 'FINISHED',
                        confirmed: true,
                      })
                    }
                  />
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
                          void action(
                            selected,
                            `participants/${removeId}/cancel`,
                          )
                        }
                      >
                        Confirmar cancelamento
                      </Button>
                    </>
                  )}
              </Modal>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
