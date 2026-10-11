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
    !/^\/(?:events(?:\/[a-f\d]{24})?|org\/events(?:\/[a-f\d]{24}(?:\/teams)?)?)$/.test(
      url.pathname,
    )
  )
    return fallback;
  const allowed = new Set(['q', 'status', 'after', 'page', 'slide', 'scroll']);
  const nested = url.searchParams.get('returnTo');
  if (nested !== null) {
    if (
      depth >= 2 ||
      !/^\/org\/events\/[a-f\d]{24}(?:\/teams)?$/.test(url.pathname) ||
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
