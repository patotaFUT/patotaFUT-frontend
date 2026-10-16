'use client';
import { useEffect, useState } from 'react';
import { GiRunningShoe, GiSoccerBall } from 'react-icons/gi';
import { Button } from '@/components/ui/button';
import { statisticsClient } from '../browser-client';
import { eventContent } from '@/features/events/events.content';
import type { EventHighlights as Highlights } from '../statistics.contracts';
import common from '@/features/events/components/events.module.css';
import styles from './statistics.module.css';
export function EventHighlights({
  eventId,
  revision,
  busy,
  onConfirm,
}: {
  eventId: string;
  revision: number;
  busy: boolean;
  onConfirm: (revision: number) => void;
}) {
  const [data, setData] = useState<Highlights>();
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    void statisticsClient
      .highlights(eventId)
      .then((value) => {
        if (active) setData(value);
      })
      .catch((caught: unknown) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : 'Não foi possível carregar os destaques.',
          );
      });
    return () => {
      active = false;
    };
  }, [eventId, revision, reload]);
  return (
    <>
      {!data && !error && <p role="status">Carregando destaques...</p>}
      {error && (
        <>
          <p role="alert" className={common.error}>
            {error}
          </p>
          <Button
            className={common.solid}
            onClick={() => setReload((v) => v + 1)}
          >
            Tentar novamente
          </Button>
        </>
      )}
      {data && (
        <div className={styles.highlights} aria-label="Destaques do evento">
          {(
            ['scorers', 'assistants'] satisfies ('scorers' | 'assistants')[]
          ).map((kind) => {
            const Icon = kind === 'scorers' ? GiSoccerBall : GiRunningShoe;
            return (
              <section
                className={styles.highlight}
                key={kind}
                aria-label={kind === 'scorers' ? 'Artilheiro' : 'Assistente'}
              >
                <h3>{kind === 'scorers' ? 'Artilheiro' : 'Assistente'}</h3>
                <Icon className={styles.highlightIcon} aria-hidden="true" />
                {data[kind].length === 0 ? (
                  <p>
                    {kind === 'scorers' ? 'Sem artilheiro' : 'Sem assistente'}
                  </p>
                ) : (
                  <ul className={styles.winners}>
                    {data[kind].map((row) => (
                      <li key={row.userId}>
                        {row.firstName} {row.lastName}
                        <br />
                        <span>
                          {kind === 'scorers'
                            ? `${row.goals} ${row.goals === 1 ? 'gol' : 'gols'}`
                            : `${row.assists} ${row.assists === 1 ? 'assistência' : 'assistências'}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      <p>{eventContent.finishConfirm}</p>
      <Button
        className={`${common.solid} ${common.highlight} ${common.centerAction}`}
        disabled={busy || !data || !!error}
        onClick={() => {
          if (data) onConfirm(data.revision);
        }}
      >
        Confirmar finalização
      </Button>
    </>
  );
}
