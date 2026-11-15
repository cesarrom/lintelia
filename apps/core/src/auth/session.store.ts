import { createHash, randomBytes } from 'node:crypto';
import type { Redis } from '../clients/redis.client';
import type { PrincipalKind } from './tokens';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newSecret = () => randomBytes(32).toString('base64url');

export interface SessionRecord {
  sid: string;
  kind: PrincipalKind;
  userId: string;
  tenantId: string | null;
  createdAt: number;
}

/**
 * Server-side sessions in Redis. Access tokens (short-lived JWTs) carry the session id; a session can be revoked at
 * any time (logout, deactivation, password change) and the next request fails. Refresh tokens rotate on every use;
 * presenting an already-used refresh token revokes the session (reuse detection, OAuth 2.0 Security BCP).
 */
export class SessionStore {
  constructor(private readonly redis: Redis, private readonly ttlSeconds: number) { }

  private key = (sid: string) => `session:${sid}`;
  private userKey = (kind: PrincipalKind, tenantId: string | null, userId: string) => `user-sessions:${kind}:${tenantId ?? 'platform'}:${userId}`;

  async create(input: Omit<SessionRecord, 'sid' | 'createdAt'>): Promise<{ session: SessionRecord; refreshToken: string }> {
    const sid = randomBytes(18).toString('base64url');
    const secret = newSecret();
    const session: SessionRecord = { ...input, sid, createdAt: Date.now() };
    await this.redis.send('HSET', [this.key(sid), 'data', JSON.stringify(session), 'refresh', sha256(secret)]);
    await this.redis.expire(this.key(sid), this.ttlSeconds);
    const userKey = this.userKey(input.kind, input.tenantId, input.userId);
    await this.redis.send('SADD', [userKey, sid]);
    await this.redis.expire(userKey, this.ttlSeconds);
    return { session, refreshToken: `${sid}.${secret}` };
  }

  async get(sid: string | undefined): Promise<SessionRecord | null> {
    if (!sid) return null;
    const data = await this.redis.send('HGET', [this.key(sid), 'data']);
    return data ? JSON.parse(String(data)) : null;
  }

  /** Exchange a refresh token for a new one. Returns null when invalid; revokes the session on reuse. */
  async rotate(refreshToken: string | undefined): Promise<{ session: SessionRecord; refreshToken: string } | null> {
    const [sid, secret] = (refreshToken ?? '').split('.');
    if (!sid || !secret) return null;
    const [data, stored] = (await this.redis.send('HMGET', [this.key(sid), 'data', 'refresh'])) as [string | null, string | null];
    if (!data || !stored) return null;
    if (stored !== sha256(secret)) {
      await this.revoke(sid);
      return null;
    }
    const next = newSecret();
    await this.redis.send('HSET', [this.key(sid), 'refresh', sha256(next)]);
    await this.redis.expire(this.key(sid), this.ttlSeconds);
    return { session: JSON.parse(data), refreshToken: `${sid}.${next}` };
  }

  async revoke(sid: string) {
    const session = await this.get(sid);
    await this.redis.del(this.key(sid));
    if (session) await this.redis.send('SREM', [this.userKey(session.kind, session.tenantId, session.userId), sid]);
  }

  /** Revoke every session of a user, optionally keeping one (e.g. the one that changed the password). */
  async revokeAll(kind: PrincipalKind, tenantId: string | null, userId: string, exceptSid?: string) {
    const userKey = this.userKey(kind, tenantId, userId);
    const sids = ((await this.redis.send('SMEMBERS', [userKey])) as string[]) ?? [];
    for (const sid of sids) {
      if (sid === exceptSid) continue;
      await this.redis.del(this.key(sid));
      await this.redis.send('SREM', [userKey, sid]);
    }
  }
}

/** Counters with expiry (sign-in lockout, rate limits). */
export class Throttle {
  constructor(private readonly redis: Redis) { }

  /** Count one hit; returns the count within the window. */
  async hit(key: string, windowSeconds: number): Promise<number> {
    const count = await this.redis.incr(`throttle:${key}`);
    if (count === 1) await this.redis.expire(`throttle:${key}`, windowSeconds);
    return count;
  }

  async count(key: string): Promise<number> {
    return Number((await this.redis.get(`throttle:${key}`)) ?? 0);
  }

  async reset(key: string) {
    await this.redis.del(`throttle:${key}`);
  }
}

/** Single-use secrets with expiry (one-time codes, password reset tokens). */
export class OneTimeSecrets {
  constructor(private readonly redis: Redis) { }

  async put(namespace: string, secret: string, value: Record<string, unknown>, ttlSeconds: number) {
    await this.redis.set(`secret:${namespace}:${sha256(secret)}`, JSON.stringify(value), 'EX', ttlSeconds);
  }

  /** Returns the value without consuming it. */
  async peek<T = Record<string, unknown>>(namespace: string, secret: string): Promise<T | null> {
    const value = await this.redis.get(`secret:${namespace}:${sha256(secret)}`);
    return value ? (JSON.parse(value) as T) : null;
  }

  /** Replace the value, keeping the expiry. */
  async update(namespace: string, secret: string, value: Record<string, unknown>) {
    await this.redis.send('SET', [`secret:${namespace}:${sha256(secret)}`, JSON.stringify(value), 'KEEPTTL', 'XX']);
  }

  /** Returns the value and deletes it (single use). */
  async take<T = Record<string, unknown>>(namespace: string, secret: string): Promise<T | null> {
    const key = `secret:${namespace}:${sha256(secret)}`;
    const value = await this.redis.get(key);
    if (!value) return null;
    await this.redis.del(key);
    return JSON.parse(value) as T;
  }
}
