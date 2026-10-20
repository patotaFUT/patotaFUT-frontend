// Server Route Handler only. Never expose this configuration to client bundles.
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function proxyOriginHeaders(
  request: Request,
  target: URL,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  now = Date.now(),
): Record<string, string> {
  const secret = environment.API_PROXY_SECRET;
  const vercel = environment.VERCEL === '1';
  const production = environment.NODE_ENV === 'production';
  const localTarget = ['localhost', '127.0.0.1', '[::1]'].includes(
    target.hostname,
  );
  // Local next start/fixtures use a shared local origin, never header IPs.
  if (!secret && !vercel && (!production || localTarget)) return {};
  if (!secret || Buffer.byteLength(secret) < 32 || secret !== secret.trim())
    throw new Error('Invalid proxy configuration');
  // Vercel sets this header at its edge. Outside that runtime, never treat a
  // browser-supplied header as platform metadata. Local development is loopback.
  if (!vercel && production && !localTarget)
    throw new Error('Unsupported proxy platform');
  const ip = vercel
    ? request.headers.get('x-vercel-forwarded-for')
    : '127.0.0.1';
  if (!ip || ip !== ip.trim() || ip.includes('%') || !isIP(ip))
    throw new Error('Missing platform origin');
  const timestamp = String(now);
  const signature = createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'patotafut-origin-v1',
        timestamp,
        request.method,
        target.pathname + target.search,
        ip,
      ]),
    )
    .digest('hex');
  return {
    'x-patotafut-ip': ip,
    'x-patotafut-time': timestamp,
    'x-patotafut-signature': signature,
  };
}
