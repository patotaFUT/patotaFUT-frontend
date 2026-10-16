// Date.now is the reference; intervals only request repaint, never subtract time.
export function remainingSeconds(
  startedAt: string,
  durationMinutes: number,
  now: number,
): number {
  return Math.max(
    0,
    Math.ceil(
      (durationMinutes * 60000 - Math.max(0, now - Date.parse(startedAt))) /
        1000,
    ),
  );
}
export function clockText(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export function defaultGoalMinute(
  startedAt: string,
  duration: number,
  now: number,
): number {
  const elapsed = Math.max(
    0,
    Math.floor((now - Date.parse(startedAt)) / 60000),
  );
  return now - Date.parse(startedAt) >= duration * 60000 ? 0 : elapsed;
}
