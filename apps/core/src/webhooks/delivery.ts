import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { env } from '../constants';

/** Standard Webhooks signature of one message with one secret (`whsec_<base64>`). */
export function signStandardWebhook(secret: string, id: string, timestamp: number, body: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./];
const isPrivateAddress = (address: string) =>
  isIP(address) === 6 ? /^(::1|fc|fd|fe80|::ffff:(10|127|192\.168|172\.(1[6-9]|2\d|3[01]))\.)/i.test(address) : PRIVATE_V4.some((r) => r.test(address));

/**
 * Webhook URLs must be HTTPS and resolve to public addresses (SSRF protection), except in local development.
 * Checked when a subscription is saved and again before every attempt (DNS can change).
 */
export async function assertDeliverableUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (env.WEBHOOK_ALLOW_PRIVATE_URLS) {
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Webhook URLs must use http(s)');
    return url;
  }
  if (url.protocol !== 'https:') throw new Error('Webhook URLs must use HTTPS');
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error('Webhook URLs must not point to private networks');
  return url;
}

export interface AttemptResult {
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  latencyMs: number;
  responseExcerpt: string | null;
  /** 410 Gone: the receiver asks us to stop. */
  gone: boolean;
}

/** One HTTP attempt (10 s timeout). Never throws: failures are results, retried by the durable delivery. */
export async function attemptDelivery(input: { url: string; eventId: string; body: string; secrets: string[] }): Promise<AttemptResult> {
  const started = Date.now();
  const timestamp = Math.floor(started / 1000);
  try {
    await assertDeliverableUrl(input.url);
    const response = await fetch(input.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lintelia-Webhooks/1.0',
        'webhook-id': input.eventId,
        'webhook-timestamp': String(timestamp),
        // During a secret rotation both signatures are sent (space-separated), as Standard Webhooks specifies.
        'webhook-signature': input.secrets.map((s) => signStandardWebhook(s, input.eventId, timestamp, input.body)).join(' '),
      },
      body: input.body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text().catch(() => '');
    return {
      ok: response.status >= 200 && response.status < 300, statusCode: response.status, error: response.ok ? null : `HTTP ${response.status}`,
      latencyMs: Date.now() - started, responseExcerpt: text.slice(0, 1024) || null, gone: response.status === 410,
    };
  } catch (error) {
    return { ok: false, statusCode: null, error: (error as Error).message.slice(0, 300), latencyMs: Date.now() - started, responseExcerpt: null, gone: false };
  }
}
