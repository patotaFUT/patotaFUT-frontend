export function safeReturn(
  value: string | null,
  fallback: string,
  depth = 0,
): string {
  if (
    !value ||
    value.length > 4096 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u001f]/.test(value)
  )
    return fallback;
  const url = new URL(value, 'http://internal.invalid');
  if (
    url.origin !== 'http://internal.invalid' ||
    url.hash ||
    !/^\/(?:events(?:\/[a-f\d]{24})?|org\/events(?:\/[a-f\d]{24}(?:\/teams(?:\/edit)?)?)?)$/.test(
      url.pathname,
    )
  )
    return fallback;
  const allowed = new Set(['q', 'status', 'after', 'page', 'slide', 'scroll']);
  const nested = url.searchParams.get('returnTo');
  if (nested !== null) {
    if (
      depth >= 2 ||
      !/^\/org\/events\/[a-f\d]{24}(?:\/teams(?:\/edit)?)?$/.test(
        url.pathname,
      ) ||
      safeReturn(nested, '', depth + 1) === ''
    )
      return fallback;
    allowed.add('returnTo');
  }
  if (Array.from(url.searchParams.keys()).some((key) => !allowed.has(key)))
    return fallback;
  return url.pathname + url.search;
}
export function withReturn(path: string, origin: string): string {
  return `${path}?returnTo=${encodeURIComponent(safeReturn(origin, '/org/events'))}`;
}

// Same explicit destinations as the former content links; never depend on browser history.
export function eventBackHref(input: {
  eventId: string | undefined;
  managing: boolean;
  view: 'manage' | 'teams' | 'editTeams';
  organizer: boolean;
  returnTo: string | null;
}): string | undefined {
  if (input.eventId === undefined) return input.managing ? '/org' : undefined;
  if (input.view === 'editTeams')
    return withReturn(
      `/org/events/${input.eventId}/teams`,
      safeReturn(input.returnTo, '/org/events'),
    );
  return safeReturn(
    input.returnTo,
    input.managing
      ? input.view === 'teams' && input.organizer
        ? `/org/events/${input.eventId}`
        : '/org/events'
      : '/events',
  );
}
