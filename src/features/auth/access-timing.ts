// Only access restoration gets the Render wake-up budget. Ordinary requests keep 15s.
export const accessRequestTimeout = 60_000;
export const accessRestoreTimeout = 75_000;

export function proxyTimeout(segments: readonly string[]): number {
  return segments.length === 2 &&
    segments[0] === 'auth' &&
    ['me', 'csrf', 'refresh'].includes(segments[1] ?? '')
    ? accessRequestTimeout
    : 15_000;
}
