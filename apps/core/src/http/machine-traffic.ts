import type { MiddlewareHandler } from 'hono';
import { createHash } from 'node:crypto';
import { redis } from '../clients/redis.client';
import { env } from '../constants';
import type { AuthContext } from '../auth/auth-context';

/**
 * Traffic rules for API clients (docs/plans/04): rate limits per client and per institution (fixed one-minute
 * windows in Redis, `429` with `Retry-After`), and `Idempotency-Key` on POST (Stripe's pattern: the first response is
 * kept 24 hours and replayed for retries with the same body; a different body with the same key is `422`; a retry
 * while the first request is still running is `409`).
 */
const IDEMPOTENCY_TTL_SECONDS = 24 * 3600;

async function hit(key: string, limit: number) {
  const count = Number(await redis().send('INCR', [key]));
  if (count === 1) await redis().send('EXPIRE', [key, '60']);
  return count > limit;
}

export const machineTraffic = (): MiddlewareHandler => async (c, next) => {
  const auth = (c.req as unknown as { auth?: AuthContext }).auth;
  if (auth?.claims?.kind !== 'api_client' || !auth.user || !auth.tenant) return next();
  const window = Math.floor(Date.now() / 60_000);
  const retryAfter = String(60 - Math.floor((Date.now() / 1000) % 60));
  if (await hit(`rate:client:${auth.user.userId}:${window}`, env.API_CLIENT_RATE_LIMIT) || await hit(`rate:tenant:${auth.tenant.id}:${window}`, env.API_TENANT_RATE_LIMIT)) {
    return c.json({ error: 'rate_limited', message: 'Too many requests: slow down' }, 429, { 'Retry-After': retryAfter });
  }

  const key = c.req.header('idempotency-key');
  if (c.req.method !== 'POST' || !key) return next();
  if (key.length > 255) return c.json({ error: 'Idempotency-Key is too long' }, 400);
  const body = await c.req.raw.clone().text();
  const bodyHash = createHash('sha256').update(`${c.req.path}\n${body}`).digest('hex');
  const storeKey = `idem:${auth.user.userId}:${createHash('sha256').update(key).digest('hex')}`;
  const claimed = await redis().send('SET', [storeKey, JSON.stringify({ state: 'running', bodyHash }), 'EX', String(IDEMPOTENCY_TTL_SECONDS), 'NX']);
  if (!claimed) {
    const previous = JSON.parse(String(await redis().get(storeKey) ?? '{}')) as { state?: string; bodyHash?: string; status?: number; body?: string; contentType?: string };
    if (previous.bodyHash !== bodyHash) return c.json({ error: 'This Idempotency-Key was used with a different request' }, 422);
    if (previous.state !== 'done') return c.json({ error: 'A request with this Idempotency-Key is still in progress' }, 409);
    return new Response(previous.body ?? null, { status: previous.status, headers: { 'Content-Type': previous.contentType ?? 'application/json', 'Idempotent-Replayed': 'true' } });
  }
  try {
    await next();
  } catch (error) {
    await redis().del(storeKey);
    throw error;
  }
  // Server errors are not remembered: the client may retry them.
  if (c.res.status >= 500) {
    await redis().del(storeKey);
    return;
  }
  const text = await c.res.clone().text();
  await redis().set(storeKey, JSON.stringify({ state: 'done', bodyHash, status: c.res.status, body: text, contentType: c.res.headers.get('content-type') }), 'EX', IDEMPOTENCY_TTL_SECONDS);
};
