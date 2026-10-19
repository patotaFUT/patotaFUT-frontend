// Imported by the server Route Handler only. Never import into Client Components.
// The browser knows /api; only the Next.js server reads the backend origin.
import { proxyTimeout } from '../../features/auth/access-timing';

const privateCacheHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};
const requestHeaders = [
  'accept',
  'accept-language',
  'content-type',
  'cookie',
  'origin',
  'referer',
  'user-agent',
  'x-csrf-token',
];
const hopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function apiOrigin(value: string | undefined): URL {
  if (!value || value !== value.trim())
    throw new Error('Invalid API configuration');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid API configuration');
  return url;
}

export function proxyCookie(cookie: string): string {
  const parts = cookie.split(';');
  const attributes = parts.slice(1).flatMap((part) => {
    const attribute = part.trim();
    if (/^domain=/i.test(attribute)) return [];
    if (/^path=/i.test(attribute)) {
      const path = attribute.slice(5);
      return [`Path=${path === '/' ? '/' : `/api${path}`}`];
    }
    return [attribute];
  });
  return [parts[0], ...attributes].join('; ');
}

function failure(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: privateCacheHeaders },
  );
}

// A dependency argument lets tests exercise transport failures without network access.
export async function forwardApi(
  request: Request,
  segments: readonly string[],
  configuredUrl: string | undefined,
  transport: typeof fetch = fetch,
): Promise<Response> {
  let origin: URL;
  try {
    origin = apiOrigin(configuredUrl);
  } catch {
    return failure(
      503,
      'O serviço está indisponível. Tente novamente em instantes.',
    );
  }
  if (
    !['auth', 'events', 'statistics', 'account'].includes(segments[0] ?? '') ||
    segments.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))
  )
    return failure(404, 'Recurso não encontrado.');

  const target = new URL(`/${segments.join('/')}`, origin);
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  // Do not invent Origin or trust client-supplied X-Forwarded-* / Host headers.
  // Client IP attribution requires verification of the actual Vercel/Render chain.
  try {
    const body = ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : await request.arrayBuffer();
    const upstream = await transport(target, {
      method: request.method,
      headers,
      ...(body === undefined ? {} : { body }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(proxyTimeout(segments)),
      ]),
    });
    const outgoing = new Headers();
    const connectionHeaders = new Set(
      (upstream.headers.get('connection') ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase()),
    );
    for (const [name, value] of upstream.headers) {
      if (
        !hopHeaders.has(name) &&
        !connectionHeaders.has(name) &&
        ![
          'set-cookie',
          'content-length',
          'content-encoding',
          'location',
        ].includes(name)
      )
        outgoing.set(name, value);
    }
    const location = upstream.headers.get('location');
    if (location !== null) {
      const redirect = new URL(location, target);
      if (
        redirect.origin !== origin.origin ||
        !/^\/(?:auth|events|statistics)(?:\/|$)/.test(redirect.pathname)
      )
        return failure(
          502,
          'Não foi possível concluir a operação. Tente novamente.',
        );
      outgoing.set(
        'location',
        `/api${redirect.pathname}${redirect.search}${redirect.hash}`,
      );
    }
    for (const cookie of upstream.headers.getSetCookie())
      outgoing.append('Set-Cookie', proxyCookie(cookie));
    for (const [name, value] of Object.entries(privateCacheHeaders))
      outgoing.set(name, value);
    return new Response(
      request.method === 'HEAD' || [204, 205, 304].includes(upstream.status)
        ? null
        : upstream.body,
      { status: upstream.status, headers: outgoing },
    );
  } catch (error: unknown) {
    return failure(
      error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
      'O serviço está indisponível. Tente novamente em instantes.',
    );
  }
}
