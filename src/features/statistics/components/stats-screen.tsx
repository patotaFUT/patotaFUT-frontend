'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FiCalendar, FiSearch } from 'react-icons/fi';
import { GiRunningShoe, GiSoccerBall } from 'react-icons/gi';
import { Button } from '@/components/ui/button';
import { GlobalAccessLoading } from '@/features/auth/components/global-access-loading';
import { useAuth } from '@/features/auth/use-auth';
import { AppShell } from '@/features/events/components/app-shell';
import { Modal } from '@/features/events/components/modal';
import { EventRequestError } from '@/features/events/events.service';
import { formatEventDate } from '@/features/events/events.calendar';
import common from '@/features/events/components/events.module.css';
import { statisticsClient } from '../browser-client';
import type { Period, StatisticsDto } from '../statistics.contracts';
import { searchRanking } from '../statistics.contracts';
import { PeriodForm } from './period-form';
import styles from './statistics.module.css';

export function StatsScreen() {
  const auth = useAuth(),
    router = useRouter();
  const authenticated = auth.session.status === 'authenticated';
  const [period, setPeriod] = useState<Period>();
  const [data, setData] = useState<StatisticsDto>();
  const [category, setCategory] = useState<'scorers' | 'assistants'>('scorers');
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string>();
  const [reload, setReload] = useState(0),
    [calendar, setCalendar] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (auth.session.status === 'unauthenticated') router.replace('/');
  }, [auth.session.status, router]);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    setLoading(true);
    setError(undefined);
    void statisticsClient
      .list(period)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível carregar as estatísticas.',
        );
        if (caught instanceof EventRequestError && caught.status === 401)
          void auth.restore(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authenticated, period, reload, auth.restore]);
  useEffect(() => {
    if (searchOpen) input.current?.focus();
  }, [searchOpen]);
  const rows = data ? searchRanking(data[category], search) : [];
  const selectedPeriod = period ?? data?.period;
  const Icon = category === 'scorers' ? GiSoccerBall : GiRunningShoe;
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'scorers'
        : event.key === 'End'
          ? 'assistants'
          : category === 'scorers'
            ? 'assistants'
            : 'scorers';
    setCategory(next);
    document.getElementById(`statistics-${next}-tab`)?.focus();
  }
  return (
    <AppShell
      title="Estatísticas dos Jogadores"
      section="stats"
      managing={false}
      organization={authenticated && auth.session.status === 'authenticated'}
      onLogout={() => void auth.logout()}
      busy={auth.operation !== 'idle'}
    >
      <GlobalAccessLoading
        session={auth.session}
        onRetry={() => void auth.restore()}
      />
      {authenticated && (
        <section
          className={styles.card}
          aria-label="Estatísticas do período"
          aria-busy={loading}
        >
          <div className={styles.toolbar}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Categoria das estatísticas"
            >
              {(
                ['scorers', 'assistants'] satisfies ('scorers' | 'assistants')[]
              ).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  id={`statistics-${kind}-tab`}
                  aria-controls="statistics-panel"
                  aria-selected={category === kind}
                  tabIndex={category === kind ? 0 : -1}
                  className={styles.tab}
                  onClick={() => setCategory(kind)}
                  onKeyDown={tabKey}
                >
                  {kind === 'scorers' ? 'Artilharia' : 'Assistentes'}
                </button>
              ))}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={common.iconButton}
                aria-label="Selecionar período"
                disabled={!selectedPeriod}
                onClick={() => setCalendar(true)}
              >
                <FiCalendar aria-hidden="true" />
              </button>
              <button
                type="button"
                className={common.iconButton}
                aria-label="Buscar jogador"
                aria-expanded={searchOpen}
                aria-controls="statistics-search"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setSearch('');
                }}
              >
                <FiSearch aria-hidden="true" />
              </button>
            </div>
          </div>
          {searchOpen && (
            <label
              className={`${common.field} ${styles.search}`}
              id="statistics-search"
            >
              <span className="visually-hidden">
                Buscar por nome ou sobrenome
              </span>
              <span className={common.fieldBox}>
                <FiSearch aria-hidden="true" />
                <input
                  ref={input}
                  type="search"
                  value={search}
                  maxLength={200}
                  placeholder="Nome ou sobrenome..."
                  onChange={(event) => setSearch(event.target.value)}
                />
              </span>
            </label>
          )}
          {selectedPeriod && (
            <p className={styles.period}>
              <strong>Período:</strong> {formatEventDate(selectedPeriod.from)}{' '}
              até {formatEventDate(selectedPeriod.to)}
            </p>
          )}
          <div
            id="statistics-panel"
            role="tabpanel"
            aria-labelledby={`statistics-${category}-tab`}
            tabIndex={0}
          >
            {loading && (
              <p className={styles.state} role="status">
                Carregando estatísticas...
              </p>
            )}
            {error && (
              <div className={styles.state}>
                <p role="alert" className={common.error}>
                  {error}
                </p>
                <Button
                  className={common.solid}
                  onClick={() => setReload((v) => v + 1)}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            {!loading &&
              !error &&
              data &&
              (data.finishedMatchCount === 0 ? (
                <p className={styles.state} role="status">
                  Nenhuma partida finalizada no período.
                </p>
              ) : data[category].length === 0 ? (
                <p className={styles.state} role="status">
                  Nenhum jogador elegível no período.
                </p>
              ) : rows.length === 0 ? (
                <p className={styles.state} role="status">
                  Nenhum jogador encontrado.
                </p>
              ) : (
                <ol
                  className={styles.list}
                  aria-label={
                    category === 'scorers'
                      ? 'Ranking de artilharia'
                      : 'Ranking de assistentes'
                  }
                >
                  {rows.map((row) => {
                    const count =
                      category === 'scorers' ? row.goals : row.assists;
                    return (
                      <li
                        key={row.userId}
                        className={styles.row}
                        data-position={row.position}
                        data-podium={
                          count > 0 && row.position <= 3
                            ? row.position
                            : undefined
                        }
                      >
                        <Icon className={styles.rankIcon} aria-hidden="true" />
                        <span className={styles.position}>{row.position}º</span>
                        <span className={styles.name}>
                          {row.firstName} {row.lastName}
                        </span>
                        <span className={styles.count}>
                          {count}
                          <span className="visually-hidden">
                            {' '}
                            {category === 'scorers' ? 'gols' : 'assistências'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ))}
          </div>
        </section>
      )}
      {calendar && selectedPeriod && (
        <Modal
          title="Selecionar período"
          busy={false}
          onClose={() => setCalendar(false)}
        >
          <PeriodForm
            initial={selectedPeriod}
            onSave={(value) => {
              setPeriod(value);
              setCalendar(false);
            }}
          />
        </Modal>
      )}
    </AppShell>
  );
}
