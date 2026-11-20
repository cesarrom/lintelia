import type { Tenant, User } from '@repo/lintelia/schemas';
import type { SessionClaims } from './tokens';

/**
 * Who is calling and on behalf of which tenant. Resolved once per HTTP request / Restate invocation by
 * IdentityService.resolve and attached to the request object as `auth`.
 */
export interface AuthContext {
  /** Verified claims, or null for anonymous callers (missing/invalid/expired token, or tenant mismatch). */
  claims: SessionClaims | null;
  /** The raw bearer token, only when it verified. */
  token: string | null;
  user: User | null;
  /** Tenant whose data this request may touch (see TENANT provider). */
  tenant: Tenant | null;
  /** Tenant key the caller asked for (`x-tenant` header), if any. */
  requestedTenant: string | null;
  /** Platform staff acting in `tenant` under an approved, time-bound support grant (read-only). */
  supportGrant?: { id: string; expiresAt: Date } | null;
}

export const ANONYMOUS: AuthContext = Object.freeze({
  claims: null,
  token: null,
  user: null,
  tenant: null,
  requestedTenant: null,
});
