'use client';
import { useEffect, useState } from 'react';
import { clockText, remainingSeconds } from '../match-clock';
export function MatchClock({
  startedAt,
  duration,
}: {
  startedAt: string;
  duration: number;
}) {
  const [now, setNow] = useState<number>();
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('pageshow', update);
    };
  }, [startedAt, duration]);
  return (
    <strong aria-label="Tempo restante">
      {now === undefined
        ? '--:--'
        : clockText(remainingSeconds(startedAt, duration, now))}
    </strong>
  );
}
