import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify, errors } from 'jose';

export type PrincipalKind = 'staff' | 'member' | 'client' | 'api_client';

/** Claims carried by session tokens issued by the local auth provider. */
export interface SessionClaims {
  /** User id (platform_users.id for staff, users.id otherwise). */
  sub: string;
  kind: PrincipalKind;
  email: string;
  /** Tenant id (uuid) for members and clients; absent for staff. */
  tid?: string;
  /** Tenant key (`tenants.domain`) for members and clients. */
  tdom?: string;
  /** Server-side session id (Redis); the token is only valid while the session exists. */
  sid?: string;
  /** API clients: the permissions granted to the token (space-separated). */
  scope?: string;
}

export class TokenService {
  private readonly key: Uint8Array;

  constructor(secret: string, private readonly issuer: string, private readonly ttlSeconds: number) {
    if (secret.length < 32) {
      throw new Error('AUTH_JWT_SECRET must be at least 32 characters');
    }
    this.key = new TextEncoder().encode(secret);
  }

  async issue(claims: SessionClaims, ttlSeconds = this.ttlSeconds): Promise<{ token: string; expiresAt: number }> {
    const { sub, ...rest } = claims;
    const token = await new SignJWT({ ...rest })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(sub)
      .setIssuer(this.issuer)
      .setAudience(this.issuer)
      .setIssuedAt()
      // Unique per issuance: a refreshed token never equals the previous one, even within the same second.
      .setJti(randomUUID())
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.key);
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return { token, expiresAt: exp * 1000 };
  }

  /** Returns the claims, or null when the token is missing, malformed, expired or not ours. */
  async verify(token: string | null | undefined): Promise<SessionClaims | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.issuer,
        audience: this.issuer,
        algorithms: ['HS256'],
      });
      const kind = payload.kind;
      if (typeof payload.sub !== 'string' || (kind !== 'staff' && kind !== 'member' && kind !== 'client' && kind !== 'api_client')) {
        return null;
      }
      if (kind !== 'staff' && typeof payload.tid !== 'string') {
        return null;
      }
      return {
        sub: payload.sub,
        kind,
        email: String(payload.email ?? ''),
        tid: payload.tid as string | undefined,
        tdom: payload.tdom as string | undefined,
        sid: payload.sid as string | undefined,
        scope: payload.scope as string | undefined,
      };
    } catch (error) {
      if (error instanceof errors.JOSEError) return null;
      throw error;
    }
  }
}
