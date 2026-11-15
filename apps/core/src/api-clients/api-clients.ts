import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ApiClientSecret } from '@repo/fintivio/entities/tenant';

/** Access tokens of API clients live 15 minutes (docs/plans/04). */
export const API_CLIENT_TOKEN_TTL_SECONDS = 900;
/** After a rotation the previous secret keeps working this long. */
export const ROTATION_GRACE_MS = 24 * 3600_000;

export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

export function newClientId() {
  return `fc_${randomBytes(12).toString('base64url')}`;
}

export function newSecret(): { secret: string; record: ApiClientSecret } {
  const secret = `fcs_${randomBytes(32).toString('base64url')}`;
  return { secret, record: { id: randomUUID(), hash: hashSecret(secret), prefix: secret.slice(0, 8), createdAt: new Date().toISOString(), expiresAt: null } };
}

/** Does `secret` match one of the client's valid (non-expired) secrets? Constant-time comparison of the hashes. */
export function secretMatches(secrets: ApiClientSecret[], secret: string, now = new Date()) {
  const given = Buffer.from(hashSecret(secret), 'hex');
  return secrets.some((s) => {
    if (s.expiresAt && new Date(s.expiresAt) <= now) return false;
    const stored = Buffer.from(s.hash, 'hex');
    return stored.length === given.length && timingSafeEqual(stored, given);
  });
}

/** Client credentials from `Authorization: Basic` (client_secret_basic) or the form body (client_secret_post). */
export function clientCredentials(authorization: string | null, body: Record<string, string | undefined>) {
  const basic = authorization?.match(/^Basic\s+(.+)$/i)?.[1];
  if (basic) {
    const decoded = Buffer.from(basic, 'base64').toString('utf8');
    const index = decoded.indexOf(':');
    if (index > 0) return { clientId: decodeURIComponent(decoded.slice(0, index)), clientSecret: decodeURIComponent(decoded.slice(index + 1)) };
  }
  return { clientId: body.client_id ?? '', clientSecret: body.client_secret ?? '' };
}
