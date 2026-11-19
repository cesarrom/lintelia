import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { isCustomPermission, resolvePlatformPermissions, type Tenant, type User } from '@repo/fintivio/schemas';
import { activeCustomKeys, memberAccess } from '../access/catalog';
import { apiClientIndex, apiClients, mfaFactors, platformMfaFactors, platformSettings, platformUsers, roles, supportGrants, sysInvitations, tenantSecurityPolicies, tenantSsoSettings, userRoles, users } from '../entities';
import { encryptSecret, decryptSecret } from './data-encryption';
import { hashRecoveryCode, matchTotp, newRecoveryCodes, newTotpSecret, otpauthUri } from './mfa';
import { API_CLIENT_TOKEN_TTL_SECONDS, secretMatches } from '../api-clients/api-clients';
import type { Databases, TenantDatabase } from '../clients/database.client';
import { redis } from '../clients/redis.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { env, tenantWebUrl } from '../constants';
import { TenantDirectory } from '../services/tenant-directory.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';
import { ANONYMOUS, type AuthContext } from './auth-context';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './passwords';
import { TokenService, type PrincipalKind, type SessionClaims } from './tokens';
import { OneTimeSecrets, SessionStore, Throttle } from './session.store';
import { AuditWriter } from '../services/audit.writer';

export class AuthError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 | 429 = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface Session {
  token: string;
  expiresAt: number;
  refreshToken: string;
  user: User;
}

/** A password sign-in that still needs the second factor (verify) or its enrolment (docs/plans/02). */
export type MfaChallenge = { mfaRequired: true; mfaToken: string } | { mfaEnrollmentRequired: true; enrollmentToken: string };
export type SignInResult = Session | MfaChallenge;
export const isMfaChallenge = (result: SignInResult): result is MfaChallenge => 'mfaRequired' in result || 'mfaEnrollmentRequired' in result;

/** Who is between their password and their second factor. */
interface MfaSubject {
  kind: 'staff' | 'member';
  userId: string;
  tenantId: string | null;
  email: string;
}

const MFA_CHALLENGE_TTL_SECONDS = 5 * 60;
const MFA_ENROLLMENT_TTL_SECONDS = 15 * 60;
const MFA_MAX_ATTEMPTS = 5;
const MFA_ISSUER = 'Fintivio';

type UserRow = typeof users.$inferSelect;

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILED_SIGN_INS = 5;
const LOCKOUT_SECONDS = 15 * 60;
const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_SECONDS = 60 * 60;
const STAFF_INVITATION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** What platform staff may do inside an institution under a support grant: read, never write. */
export const SUPPORT_ACCESS_PERMISSIONS = [
  'workspace:read', 'members:read', 'roles:read', 'clients:read', 'forms:read', 'workflows:read', 'variables:read',
  'integrations:read', 'cases:read', 'cases:read_all', 'audit:read',
];

export const hashInvitationToken = (token: string) => createHash('sha256').update(token).digest('hex');

const bearer = (value: string | null | undefined) => {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const isEmail = (email: unknown): email is string => typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

/**
 * Local authentication provider (replaces Descope). Users live in Postgres (tenant-scoped `users`, platform
 * `platform_users`); sessions live in Redis; access tokens are short-lived HS256 JWTs bound to a session.
 * Singleton: per-request state lives in the AuthContext it returns.
 */
@Injectable()
export class IdentityService {
  readonly tokens = new TokenService(env.AUTH_JWT_SECRET, env.AUTH_JWT_ISSUER, env.AUTH_ACCESS_TTL_SECONDS);
  readonly sessions = new SessionStore(redis(), env.AUTH_SESSION_TTL_SECONDS);
  private readonly throttle = new Throttle(redis());
  private readonly secrets = new OneTimeSecrets(redis());

  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  /**
   * Resolve the caller of a request.
   *  - credentials: `Authorization: Bearer <jwt>` (or `fallback.token` for Restate invocations whose payload carries it)
   *  - requested tenant: `x-tenant` header (tenant key or host name) or `fallback.tenant`
   * A member/client token pins the tenant: asking for a different tenant yields an anonymous context. Staff tokens
   * never get a tenant. The token's session must still exist (logout/deactivation revoke it immediately).
   */
  async resolve(headers: Headers, fallback: { token?: unknown; tenant?: unknown } = {}): Promise<AuthContext> {
    const token = bearer(headers.get('authorization')) ?? (typeof fallback.token === 'string' ? fallback.token : null);
    const requestedTenant = headers.get('x-tenant') ?? (typeof fallback.tenant === 'string' ? fallback.tenant : null);
    const verified = await this.tokens.verify(token);
    if (verified?.kind === 'api_client') return this.resolveApiClient(verified, token!, requestedTenant);
    const claims = verified && (await this.sessions.get(verified.sid)) ? verified : null;

    if (!claims) {
      const tenant = await this.directory.findByKey(requestedTenant);
      return { ...ANONYMOUS, tenant: tenant?.status === 'active' ? tenant : null, requestedTenant };
    }

    if (claims.kind === 'staff') {
      const user = await this.loadStaffUser(claims.sub);
      if (!user) return { ...ANONYMOUS, requestedTenant };
      // Staff never get a tenant, except read-only under an active grant the institution approved.
      const grant = requestedTenant ? await this.activeSupportGrant(claims.sub, requestedTenant) : null;
      if (grant) {
        return {
          claims, token, tenant: grant.tenant, requestedTenant,
          user: { ...user, permissions: SUPPORT_ACCESS_PERMISSIONS },
          supportGrant: { id: grant.id, expiresAt: grant.expiresAt },
        };
      }
      return { claims, token, user, tenant: null, requestedTenant };
    }

    const tenant = await this.directory.findById(claims.tid!);
    if (!tenant || tenant.status !== 'active') return { ...ANONYMOUS, requestedTenant };
    if (requestedTenant && !this.directory.matches(tenant, requestedTenant)) {
      return { ...ANONYMOUS, requestedTenant };
    }

    const user = await this.loadTenantUser(tenant, claims.sub);
    if (!user || user.status !== 'active') return { ...ANONYMOUS, requestedTenant };

    return { claims, token, user, tenant, requestedTenant };
  }

  /**
   * API client tokens (docs/plans/04) have no server-side session: the client is checked on every request instead, so
   * revoking it (or it expiring) takes effect immediately.
   */
  private async resolveApiClient(claims: SessionClaims, token: string, requestedTenant: string | null): Promise<AuthContext> {
    const tenant = await this.directory.findById(claims.tid!);
    if (!tenant || tenant.status !== 'active') return { ...ANONYMOUS, requestedTenant };
    if (requestedTenant && !this.directory.matches(tenant, requestedTenant)) return { ...ANONYMOUS, requestedTenant };
    const [client] = await this.databases.forTenant(tenant.id).select().from(apiClients).where(eq(apiClients.id, claims.sub)).limit(1);
    if (!client || client.status !== 'active' || (client.expiresAt && client.expiresAt <= new Date())) return { ...ANONYMOUS, requestedTenant };
    // The token's scope can only narrow what the client holds now (permissions removed since issuance are gone).
    const scope = new Set((claims.scope ?? '').split(' ').filter(Boolean));
    const user: User = {
      userId: client.id, kind: 'api_client', email: `${client.clientId}@api-clients.${tenant.domain}`, name: client.name,
      status: 'active', loginIds: [client.clientId], createTime: client.createdAt.getTime(),
      userTenants: [{ tenantId: tenant.id, tenantName: tenant.name, roleNames: [] }],
      permissions: client.permissions.filter((p) => scope.has(p)),
    };
    // Custom permissions the institution archived since grant nothing any more.
    if (user.permissions.some(isCustomPermission)) {
      const active = new Set(await activeCustomKeys(this.databases.forTenant(tenant.id)));
      user.permissions = user.permissions.filter((p) => !isCustomPermission(p) || active.has(p));
    }
    return { claims, token, user, tenant, requestedTenant };
  }

  /** OAuth 2.0 client credentials: authenticate an API client and issue a short-lived access token. */
  async issueApiClientToken(clientId: string, clientSecret: string) {
    const [index] = await this.databases.platform.select().from(apiClientIndex).where(eq(apiClientIndex.clientId, clientId)).limit(1);
    const tenant = index ? await this.directory.findById(index.tenantId) : null;
    if (!index || !tenant || tenant.status !== 'active') throw new AuthError('invalid_client');
    const db = this.databases.forTenant(tenant.id);
    const [client] = await db.select().from(apiClients).where(eq(apiClients.clientId, clientId)).limit(1);
    const throttleKey = `api-client:${clientId}`;
    if ((await this.throttle.count(throttleKey)) >= 20) throw new AuthError('Too many failed attempts', 429);
    if (!client || client.status !== 'active' || (client.expiresAt && client.expiresAt <= new Date()) || !secretMatches(client.secrets, clientSecret)) {
      await this.throttle.hit(throttleKey, LOCKOUT_SECONDS);
      throw new AuthError('invalid_client');
    }
    await db.update(apiClients).set({ lastUsedAt: new Date() }).where(eq(apiClients.id, client.id));
    const { token, expiresAt } = await this.tokens.issue({
      sub: client.id, kind: 'api_client', email: `${client.clientId}@api-clients.${tenant.domain}`, tid: tenant.id, tdom: tenant.domain, scope: client.permissions.join(' '),
    }, API_CLIENT_TOKEN_TTL_SECONDS);
    return { access_token: token, token_type: 'Bearer', expires_in: Math.round((expiresAt - Date.now()) / 1000), scope: client.permissions.join(' ') };
  }

  private async activeSupportGrant(staffId: string, tenantKey: string) {
    const tenant = await this.directory.findByKey(tenantKey);
    if (!tenant || tenant.status !== 'active') return null;
    const [grant] = await this.databases.platform.select().from(supportGrants).where(and(
      eq(supportGrants.staffId, staffId), eq(supportGrants.tenantId, tenant.id), eq(supportGrants.status, 'active'), gt(supportGrants.expiresAt, new Date()),
    )).limit(1);
    return grant ? { id: grant.id, expiresAt: grant.expiresAt!, tenant } : null;
  }

  // --- sign-in -----------------------------------------------------------------------------------------------------

  /** Tenant members and clients sign in against their tenant; without a tenant, platform staff sign in. */
  async login(tenant: Tenant | null, email: string, password: string): Promise<SignInResult> {
    if (!email || !password) throw new AuthError('Email and password are required', 400);
    const throttleKey = `sign-in:${tenant?.id ?? 'platform'}:${normalizeEmail(email)}`;
    if ((await this.throttle.count(throttleKey)) >= MAX_FAILED_SIGN_INS) {
      throw new AuthError('Too many failed attempts. Try again later or reset your password.', 429);
    }
    const fail = async () => {
      await this.throttle.hit(throttleKey, LOCKOUT_SECONDS);
      throw new AuthError('Invalid email or password');
    };

    if (!tenant) {
      // Staff sign in through the company IdP once it is enforced (break-glass accounts keep password + TOTP).
      const [staffSso] = await this.databases.platform.select().from(platformSettings).where(eq(platformSettings.key, 'staff_sso')).limit(1);
      const sso = (staffSso?.value ?? {}) as { enforce?: boolean; verifiedDomains?: string[] };
      if (sso.enforce && (sso.verifiedDomains ?? []).includes(normalizeEmail(email).split('@')[1] ?? '') && !env.STAFF_BREAK_GLASS_EMAILS.includes(normalizeEmail(email))) {
        throw new AuthError('sso_required', 403);
      }
      const [row] = await this.databases.platform.select().from(platformUsers)
        .where(sql`lower(${platformUsers.email}) = ${normalizeEmail(email)}`).limit(1);
      if (!row || row.status !== 'active' || !(await verifyPassword(password, row.passwordHash))) return fail();
      await this.throttle.reset(throttleKey);
      return this.secondFactor({ kind: 'staff', userId: row.id, tenantId: null, email: row.email });
    }

    if (await this.ssoEnforced(tenant.id, email)) throw new AuthError('sso_required', 403);
    const db = this.databases.forTenant(tenant.id);
    const [row] = await db.select().from(users).where(sql`lower(${users.email}) = ${normalizeEmail(email)}`).limit(1);
    if (!row || row.status !== 'active' || !(await verifyPassword(password, row.passwordHash))) return fail();
    await this.throttle.reset(throttleKey);
    if (row.kind !== 'member') return this.sessionForTenantUser(tenant, row);
    return this.secondFactor({ kind: 'member', userId: row.id, tenantId: tenant.id, email: row.email });
  }

  // --- second factor (docs/plans/02 §Our own MFA) -------------------------------------------------------------------

  /**
   * After the password: members and staff with a second factor must verify it; without one, staff (always) and members
   * of institutions whose policy requires it must enrol first. Clients use e-mailed codes and are not concerned.
   */
  private async secondFactor(subject: MfaSubject): Promise<SignInResult> {
    const factor = await this.factorOf(subject);
    if (factor) {
      const mfaToken = randomBytes(32).toString('base64url');
      await this.secrets.put('mfa-challenge', mfaToken, { ...subject, attempts: 0 }, MFA_CHALLENGE_TTL_SECONDS);
      return { mfaRequired: true, mfaToken };
    }
    const required = subject.kind === 'staff' || (await this.securityPolicy(subject.tenantId!)).requireMfa;
    if (!required) return this.issueFor(subject);
    const enrollmentToken = randomBytes(32).toString('base64url');
    await this.secrets.put('mfa-enrollment', enrollmentToken, { ...subject }, MFA_ENROLLMENT_TTL_SECONDS);
    return { mfaEnrollmentRequired: true, enrollmentToken };
  }

  /** A session for a member authenticated elsewhere (SSO: the IdP did the authentication, MFA included). */
  async sessionForMember(tenant: Tenant, userId: string): Promise<Session> {
    const [row] = await this.databases.forTenant(tenant.id).select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row || row.status !== 'active') throw new AuthError('Unauthorized');
    return this.sessionForTenantUser(tenant, row);
  }

  /** A staff session after the company IdP authenticated them (MFA is the IdP's). */
  async sessionForStaff(staffId: string): Promise<Session> {
    const [row] = await this.databases.platform.select().from(platformUsers).where(eq(platformUsers.id, staffId)).limit(1);
    if (!row) throw new AuthError('Unauthorized');
    return this.session({ sub: row.id, kind: 'staff', email: row.email }, null, await this.loadStaffUser(row.id));
  }

  /** A session for a client whose identity was proven by a single-use link (party invitations). */
  async sessionForClient(tenant: Tenant, userId: string): Promise<Session> {
    const [row] = await this.databases.forTenant(tenant.id).select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row || row.kind !== 'client' || row.status !== 'active') throw new AuthError('Unauthorized');
    return this.sessionForTenantUser(tenant, row);
  }

  /** Single sign-on enforced for this address: passwords are refused (FIA-06). */
  private async ssoEnforced(tenantId: string, email: string) {
    const [settings] = await this.databases.forTenant(tenantId).select().from(tenantSsoSettings).limit(1);
    const domain = normalizeEmail(email).split('@')[1] ?? '';
    return !!settings?.enforce && settings.verifiedDomains.includes(domain);
  }

  /** The institution's security policy (defaults when it never changed it: MFA required). */
  async securityPolicy(tenantId: string) {
    const [row] = await this.databases.forTenant(tenantId).select().from(tenantSecurityPolicies).limit(1);
    return {
      requireMfa: row?.requireMfa ?? true,
      /** Access changes that grant something wait for a second administrator (docs/plans/15 §14). */
      accessApproval: row?.accessApproval ?? 'off',
      accessNotify: row?.accessNotify ?? [],
      /** Who opened which client through the back office's custom pages is recorded (docs/plans/16 §5.5). */
      readAudit: row?.readAudit ?? false,
      updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedByEmail ?? null,
    };
  }

  private async factorOf(subject: MfaSubject) {
    if (subject.kind === 'staff') {
      const [row] = await this.databases.platform.select().from(platformMfaFactors).where(and(eq(platformMfaFactors.staffId, subject.userId), eq(platformMfaFactors.type, 'totp'))).limit(1);
      return row ? { id: row.id, secretCiphertext: row.secretCiphertext, recoveryCodes: row.recoveryCodes, lastUsedStep: row.lastUsedStep } : null;
    }
    const [row] = await this.databases.forTenant(subject.tenantId!).select().from(mfaFactors).where(and(eq(mfaFactors.userId, subject.userId), eq(mfaFactors.type, 'totp'))).limit(1);
    return row ? { id: row.id, secretCiphertext: row.secretCiphertext, recoveryCodes: row.recoveryCodes, lastUsedStep: row.lastUsedStep } : null;
  }

  private factorContext = (subject: MfaSubject) => `mfa:${subject.tenantId ?? 'platform'}:${subject.userId}`;

  private async issueFor(subject: MfaSubject): Promise<Session> {
    if (subject.kind === 'staff') return this.session({ sub: subject.userId, kind: 'staff', email: subject.email }, null, await this.loadStaffUser(subject.userId));
    const tenant = await this.directory.findById(subject.tenantId!);
    if (!tenant || tenant.status !== 'active') throw new AuthError('Unauthorized');
    const [row] = await this.databases.forTenant(tenant.id).select().from(users).where(eq(users.id, subject.userId)).limit(1);
    if (!row || row.status !== 'active') throw new AuthError('Unauthorized');
    return this.sessionForTenantUser(tenant, row);
  }

  private async auditMfa(subject: MfaSubject, action: string, details: Record<string, unknown> = {}) {
    if (subject.tenantId) await this.audit.record(subject.tenantId, { type: subject.kind, id: subject.userId, email: subject.email }, action, { type: 'user', id: subject.userId }, details);
  }

  /** Start a TOTP enrolment: a new secret for the authenticator app (kept until confirmed with a code). */
  async enrollTotp(enrollmentToken: string) {
    const subject = await this.secrets.peek<MfaSubject & { pendingSecret?: string }>('mfa-enrollment', enrollmentToken ?? '');
    if (!subject) throw new AuthError('The enrolment expired: sign in again');
    const secret = newTotpSecret();
    await this.secrets.update('mfa-enrollment', enrollmentToken, { ...subject, pendingSecret: secret });
    return { secret, otpauthUri: otpauthUri(secret, subject.email, MFA_ISSUER) };
  }

  /** Confirm the enrolment with a first code: the factor is saved (encrypted) and recovery codes are shown once. */
  async confirmTotp(enrollmentToken: string, code: string): Promise<Session & { recoveryCodes: string[] }> {
    const subject = await this.secrets.peek<MfaSubject & { pendingSecret?: string }>('mfa-enrollment', enrollmentToken ?? '');
    if (!subject?.pendingSecret) throw new AuthError('The enrolment expired: sign in again');
    if (matchTotp(subject.pendingSecret, String(code ?? '').trim()) === null) throw new AuthError('The code is not valid: check the time on your device and try again');
    await this.secrets.take('mfa-enrollment', enrollmentToken);
    const { pendingSecret, ...who } = subject;
    const secretCiphertext = encryptSecret(pendingSecret, this.factorContext(who));
    const { codes, stored } = newRecoveryCodes();
    if (who.kind === 'staff') {
      await this.databases.platform.insert(platformMfaFactors).values({ staffId: who.userId, type: 'totp', secretCiphertext, recoveryCodes: stored })
        .onConflictDoUpdate({ target: [platformMfaFactors.staffId, platformMfaFactors.type], set: { secretCiphertext, recoveryCodes: stored, lastUsedStep: null } });
    } else {
      await this.databases.forTenant(who.tenantId!).insert(mfaFactors).values({ userId: who.userId, type: 'totp', secretCiphertext, recoveryCodes: stored })
        .onConflictDoUpdate({ target: [mfaFactors.tenantId, mfaFactors.userId, mfaFactors.type], set: { secretCiphertext, recoveryCodes: stored, lastUsedStep: null } });
    }
    await this.auditMfa(who, 'mfa.enrolled', { type: 'totp' });
    return { ...(await this.issueFor(who)), recoveryCodes: codes };
  }

  /** Second step of a sign-in: a TOTP code (never twice the same) or an unused recovery code. */
  async verifyMfa(mfaToken: string, code: string): Promise<Session> {
    const challenge = await this.secrets.peek<MfaSubject & { attempts: number }>('mfa-challenge', mfaToken ?? '');
    if (!challenge) throw new AuthError('The sign-in expired: start again');
    const { attempts, ...subject } = challenge;
    const factor = await this.factorOf(subject);
    if (!factor) throw new AuthError('No second factor');
    const given = String(code ?? '').trim();
    const secret = decryptSecret(factor.secretCiphertext, this.factorContext(subject));
    const step = matchTotp(secret, given);
    let changes: { lastUsedStep?: number; lastUsedAt: Date; recoveryCodes?: typeof factor.recoveryCodes } | null = null;
    if (step !== null && (factor.lastUsedStep === null || step > factor.lastUsedStep)) {
      changes = { lastUsedStep: step, lastUsedAt: new Date() };
    } else if (step === null) {
      const hash = hashRecoveryCode(given);
      const index = factor.recoveryCodes.findIndex((c) => c.hash === hash && !c.usedAt);
      if (index >= 0) {
        changes = { lastUsedAt: new Date(), recoveryCodes: factor.recoveryCodes.map((c, i) => (i === index ? { ...c, usedAt: new Date().toISOString() } : c)) };
        await this.auditMfa(subject, 'mfa.recovery_code_used', { remaining: factor.recoveryCodes.filter((c) => !c.usedAt).length - 1 });
      }
    }
    if (!changes) {
      if (attempts + 1 >= MFA_MAX_ATTEMPTS) await this.secrets.take('mfa-challenge', mfaToken);
      else await this.secrets.update('mfa-challenge', mfaToken, { ...challenge, attempts: attempts + 1 });
      throw new AuthError('The code is not valid');
    }
    await this.secrets.take('mfa-challenge', mfaToken);
    if (subject.kind === 'staff') await this.databases.platform.update(platformMfaFactors).set(changes).where(eq(platformMfaFactors.id, factor.id));
    else await this.databases.forTenant(subject.tenantId!).update(mfaFactors).set(changes).where(eq(mfaFactors.id, factor.id));
    return this.issueFor(subject);
  }

  /** Exchange a refresh token for a new access token (and a new refresh token). */
  async refresh(refreshToken: string | undefined): Promise<Session> {
    const rotated = await this.sessions.rotate(refreshToken);
    if (!rotated) throw new AuthError('Session expired');
    const { session } = rotated;
    let user: User | null;
    let claims: SessionClaims;
    if (session.kind === 'staff') {
      user = await this.loadStaffUser(session.userId);
      claims = { sub: session.userId, kind: 'staff', email: user?.email ?? '', sid: session.sid };
    } else {
      const tenant = session.tenantId ? await this.directory.findById(session.tenantId) : null;
      user = tenant && tenant.status === 'active' ? await this.loadTenantUser(tenant, session.userId) : null;
      claims = { sub: session.userId, kind: session.kind, email: user?.email ?? '', tid: tenant?.id, tdom: tenant?.domain, sid: session.sid };
    }
    if (!user || user.status !== 'active') {
      await this.sessions.revoke(session.sid);
      throw new AuthError('Session expired');
    }
    const { token, expiresAt } = await this.tokens.issue(claims);
    return { token, expiresAt, refreshToken: rotated.refreshToken, user };
  }

  async logout(claims: SessionClaims | null) {
    if (claims?.sid) await this.sessions.revoke(claims.sid);
  }

  async revokeUserSessions(kind: PrincipalKind, tenantId: string | null, userId: string, exceptSid?: string) {
    await this.sessions.revokeAll(kind, tenantId, userId, exceptSid);
  }

  /** Self-service registration of a tenant client (end user). Staff members are only added by invitation. */
  async registerClient(tenant: Tenant, input: { email: string; password: string; name?: string }): Promise<Session> {
    if (!isEmail(input.email)) throw new AuthError('A valid email is required', 400);
    const email = input.email.trim();
    const passwordHash = await hashPassword(assertPasswordPolicy(input.password));
    const db = this.databases.forTenant(tenant.id);

    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${normalizeEmail(email)}`).limit(1);
    if (existing) throw new AuthError('An account with this email already exists', 409);

    const [row] = await db.insert(users).values({ email, name: input.name?.trim() || email, kind: 'client', status: 'active', passwordHash }).returning();
    await this.audit.record(tenant.id, { type: 'client', id: row.id, email }, 'client.registered', { type: 'user', id: row.id });
    return this.sessionForTenantUser(tenant, row);
  }

  // --- passwordless codes (clients) -------------------------------------------------------------------------------

  /** E-mail a 6-digit code. Always succeeds from the caller's point of view (no account enumeration). */
  async startOtp(tenant: Tenant, rawEmail: string) {
    if (!isEmail(rawEmail)) throw new AuthError('A valid email is required', 400);
    const email = normalizeEmail(rawEmail);
    if ((await this.throttle.hit(`otp-start:${tenant.id}:${email}`, OTP_TTL_SECONDS)) > 5) {
      throw new AuthError('Too many codes requested. Try again later.', 429);
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await redis().set(`otp:${tenant.id}:${email}`, JSON.stringify({ hash: hashInvitationToken(code), attempts: 0 }), 'EX', OTP_TTL_SECONDS);
    await this.email.send({
      tenant: tenant.domain,
      to: rawEmail.trim(),
      subject: `Your ${tenant.name} verification code`,
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not ask for it, ignore this e-mail.</p>`,
    });
  }

  /** Check a code; creates the client on first use (applications can be started from any device). */
  async verifyOtp(tenant: Tenant, rawEmail: string, code: string): Promise<Session & { created: boolean }> {
    if (!isEmail(rawEmail) || !code) throw new AuthError('Email and code are required', 400);
    const email = normalizeEmail(rawEmail);
    const key = `otp:${tenant.id}:${email}`;
    const stored = await redis().get(key);
    if (!stored) throw new AuthError('The code is invalid or has expired');
    const entry = JSON.parse(stored) as { hash: string; attempts: number };
    if (entry.hash !== hashInvitationToken(code.trim())) {
      entry.attempts += 1;
      if (entry.attempts >= OTP_MAX_ATTEMPTS) await redis().del(key);
      else await redis().send('SET', [key, JSON.stringify(entry), 'KEEPTTL']);
      throw new AuthError('The code is invalid or has expired');
    }
    await redis().del(key);

    const db = this.databases.forTenant(tenant.id);
    let [row] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    let created = false;
    if (!row) {
      [row] = await db.insert(users).values({ email: rawEmail.trim(), name: rawEmail.trim(), kind: 'client', status: 'active' }).returning();
      created = true;
      await this.audit.record(tenant.id, { type: 'client', id: row.id, email: row.email }, 'client.registered', { type: 'user', id: row.id }, { method: 'email_code' });
    }
    if (row.status !== 'active') throw new AuthError('This account is disabled', 403);
    return { ...(await this.sessionForTenantUser(tenant, row)), created };
  }

  /** Find or create the client record for an e-mail (public form submissions) without signing them in. */
  async ensureClient(tenant: Tenant, rawEmail: string, name?: string) {
    const db = this.databases.forTenant(tenant.id);
    const email = rawEmail.trim();
    const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${normalizeEmail(email)}`).limit(1);
    if (existing) {
      if (existing.kind !== 'client') throw new AuthError('This e-mail address belongs to a member of the institution, not a client', 400);
      return existing;
    }
    const [row] = await db.insert(users).values({ email, name: name?.trim() || email, kind: 'client', status: 'active' }).returning();
    return row;
  }

  // --- passwords --------------------------------------------------------------------------------------------------

  /** Always answers the same way whether or not the account exists. */
  async forgotPassword(tenant: Tenant | null, rawEmail: string) {
    if (!isEmail(rawEmail)) return;
    const email = normalizeEmail(rawEmail);
    if ((await this.throttle.hit(`pw-forgot:${tenant?.id ?? 'platform'}:${email}`, 3600)) > 5) return;
    let userId: string | undefined;
    if (tenant) {
      const [row] = await this.databases.forTenant(tenant.id).select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (row && row.status === 'active') userId = row.id;
    } else {
      const [row] = await this.databases.platform.select().from(platformUsers).where(sql`lower(${platformUsers.email}) = ${email}`).limit(1);
      if (row && row.status === 'active') userId = row.id;
    }
    if (!userId) return;
    await this.sendPasswordReset(tenant, userId, rawEmail.trim());
  }

  async sendPasswordReset(tenant: Tenant | null, userId: string, email: string) {
    const token = randomBytes(32).toString('base64url');
    await this.secrets.put('password-reset', token, { tenantId: tenant?.id ?? null, userId }, RESET_TTL_SECONDS);
    const link = tenant
      ? tenantWebUrl(tenant.domain, `/reset-password?token=${token}`)
      : new URL(`/reset-password?token=${token}`, env.WEB_URL).toString();
    await this.email.send({
      tenant: tenant?.domain,
      to: email,
      subject: 'Reset your password',
      text: `Choose a new password: ${link} (valid for 1 hour). If you did not ask for it, ignore this e-mail.`,
      html: `<p><a href="${link}">Choose a new password</a> (valid for 1 hour).</p><p>If you did not ask for it, ignore this e-mail.</p>`,
    });
  }

  async resetPassword(token: string, password: string) {
    const passwordHash = await hashPassword(assertPasswordPolicy(password));
    const entry = await this.secrets.take<{ tenantId: string | null; userId: string }>('password-reset', token ?? '');
    if (!entry) throw new AuthError('The link is invalid or has expired', 404);
    if (entry.tenantId) {
      await this.databases.forTenant(entry.tenantId).update(users).set({ passwordHash, status: 'active' }).where(eq(users.id, entry.userId));
      const [row] = await this.databases.forTenant(entry.tenantId).select({ kind: users.kind, email: users.email }).from(users).where(eq(users.id, entry.userId));
      await this.revokeUserSessions(row?.kind ?? 'member', entry.tenantId, entry.userId);
      await this.audit.record(entry.tenantId, { type: row?.kind ?? 'member', id: entry.userId, email: row?.email }, 'user.password_reset', { type: 'user', id: entry.userId });
    } else {
      await this.databases.platform.update(platformUsers).set({ passwordHash }).where(eq(platformUsers.id, entry.userId));
      await this.revokeUserSessions('staff', null, entry.userId);
    }
  }

  async changePassword(auth: AuthContext, currentPassword: string, newPassword: string) {
    if (!auth.claims || !auth.user) throw new AuthError('Unauthorized');
    const passwordHash = await hashPassword(assertPasswordPolicy(newPassword));
    if (auth.claims.kind === 'staff') {
      const [row] = await this.databases.platform.select().from(platformUsers).where(eq(platformUsers.id, auth.claims.sub));
      if (!(await verifyPassword(currentPassword, row?.passwordHash))) throw new AuthError('Current password is wrong', 400);
      await this.databases.platform.update(platformUsers).set({ passwordHash }).where(eq(platformUsers.id, auth.claims.sub));
      await this.revokeUserSessions('staff', null, auth.claims.sub, auth.claims.sid);
      return;
    }
    const db = this.databases.forTenant(auth.claims.tid!);
    const [row] = await db.select().from(users).where(eq(users.id, auth.claims.sub));
    if (!(await verifyPassword(currentPassword, row?.passwordHash))) throw new AuthError('Current password is wrong', 400);
    await db.update(users).set({ passwordHash }).where(eq(users.id, auth.claims.sub));
    await this.revokeUserSessions(auth.claims.kind, auth.claims.tid!, auth.claims.sub, auth.claims.sid);
    await this.audit.record(auth.claims.tid!, { type: auth.claims.kind, id: auth.claims.sub, email: auth.user.email }, 'user.password_changed', { type: 'user', id: auth.claims.sub });
  }

  // --- invitations ------------------------------------------------------------------------------------------------

  /**
   * Invite a member into a tenant: creates (or reuses) the user in `invited` state, assigns the roles and stores an
   * invitation whose token is returned once (only its hash is stored). The caller sends the link.
   */
  async createInvitation(db: TenantDatabase, input: { email: string; name?: string; roleKeys: string[]; invitedBy: string; source?: 'manual' | 'recovery' }) {
    const email = input.email.trim();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashInvitationToken(token);

    const invitation = await db.transaction(async (tx) => {
      let [user] = await tx.select().from(users).where(sql`lower(${users.email}) = ${normalizeEmail(email)}`).limit(1);
      if (!user) {
        [user] = await tx.insert(users).values({ email, name: input.name?.trim() || '', kind: 'member', status: 'invited' }).returning();
      }

      if (input.roleKeys.length) {
        const roleRows = await tx.select({ id: roles.id, key: roles.key }).from(roles).where(inArray(roles.key, input.roleKeys));
        const missing = input.roleKeys.filter((key) => !roleRows.some((r) => r.key === key));
        if (missing.length) throw new AuthError(`Unknown role(s): ${missing.join(', ')}`, 400);
        await tx.insert(userRoles).values(roleRows.map((r) => ({ userId: user.id, roleId: r.id, source: input.source ?? 'manual', grantedByEmail: input.invitedBy }))).onConflictDoNothing();
      }

      const data = { tokenHash, userId: user.id, roles: input.roleKeys, invitedBy: input.invitedBy, expiresAt: Date.now() + INVITATION_TTL_MS };
      const [saved] = await tx.insert(sysInvitations).values({ email, roleId: input.roleKeys[0] ?? '', data })
        .onConflictDoUpdate({ target: [sysInvitations.tenantId, sysInvitations.email], set: { roleId: input.roleKeys[0] ?? '', data } })
        .returning();
      return saved;
    });

    return { invitation, token };
  }

  async acceptInvitation(tenant: Tenant, input: { token: string; password: string; name?: string }): Promise<SignInResult> {
    if (!input.token) throw new AuthError('Invitation token is required', 400);
    const passwordHash = await hashPassword(assertPasswordPolicy(input.password));
    const tokenHash = hashInvitationToken(input.token);
    const db = this.databases.forTenant(tenant.id);

    const row = await db.transaction(async (tx) => {
      const [invitation] = await tx.select().from(sysInvitations)
        .where(sql`${sysInvitations.data}->>'tokenHash' = ${tokenHash}`).limit(1);
      const data = invitation?.data as { userId?: string; expiresAt?: number } | null;
      if (!invitation || !data?.userId || !data.expiresAt || data.expiresAt < Date.now()) {
        throw new AuthError('Invitation is invalid or has expired', 404);
      }
      const [user] = await tx.update(users)
        .set({ passwordHash, status: 'active', ...(input.name?.trim() ? { name: input.name.trim() } : {}) })
        .where(eq(users.id, data.userId)).returning();
      await tx.delete(sysInvitations).where(eq(sysInvitations.id, invitation.id));
      return user;
    });

    await this.audit.record(tenant.id, { type: 'member', id: row.id, email: row.email }, 'member.activated', { type: 'user', id: row.id });
    return this.secondFactor({ kind: 'member', userId: row.id, tenantId: tenant.id, email: row.email });
  }

  /**
   * Invite a platform staff member: an `invited` account with platform roles and a single-use link (7 days) e-mailed
   * to them (platform mailbox).
   */
  async inviteStaff(input: { email: string; name?: string; roles: string[] }) {
    if (!isEmail(input.email)) throw new AuthError('A valid e-mail address is required', 400);
    const email = input.email.trim();
    const [existing] = await this.databases.platform.select().from(platformUsers).where(sql`lower(${platformUsers.email}) = ${normalizeEmail(email)}`).limit(1);
    if (existing && existing.status !== 'invited') throw new AuthError('This person already has a staff account', 409);
    const [row] = existing
      ? await this.databases.platform.update(platformUsers).set({ roles: input.roles, name: input.name?.trim() || existing.name }).where(eq(platformUsers.id, existing.id)).returning()
      : await this.databases.platform.insert(platformUsers).values({ email, name: input.name?.trim() || '', roles: input.roles, status: 'invited' }).returning();
    const token = randomBytes(32).toString('base64url');
    await this.secrets.put('staff-invitation', token, { userId: row.id }, STAFF_INVITATION_TTL_SECONDS);
    const link = new URL(`/sign-on?invitation=${token}`, env.WEB_URL).toString();
    await this.email.send({
      tenant: undefined,
      to: email,
      subject: 'You are invited to the Fintivio platform console',
      text: `You were invited to operate the Fintivio platform (${input.roles.join(', ')}). Choose a password: ${link} (valid for 7 days).`,
      html: `<p>You were invited to operate the Fintivio platform (${input.roles.join(', ')}).</p><p><a href="${link}">Choose a password</a> (valid for 7 days).</p>`,
    });
    return row;
  }

  async acceptStaffInvitation(input: { token: string; password: string; name?: string }): Promise<SignInResult> {
    if (!input.token) throw new AuthError('Invitation token is required', 400);
    const passwordHash = await hashPassword(assertPasswordPolicy(input.password));
    const entry = await this.secrets.take<{ userId: string }>('staff-invitation', input.token);
    if (!entry) throw new AuthError('Invitation is invalid or has expired', 404);
    const [row] = await this.databases.platform.update(platformUsers)
      .set({ passwordHash, status: 'active', ...(input.name?.trim() ? { name: input.name.trim() } : {}) })
      .where(and(eq(platformUsers.id, entry.userId), eq(platformUsers.status, 'invited'))).returning();
    if (!row) throw new AuthError('Invitation is invalid or has expired', 404);
    return this.secondFactor({ kind: 'staff', userId: row.id, tenantId: null, email: row.email });
  }

  // --- users ------------------------------------------------------------------------------------------------------

  async loadTenantUser(tenant: Tenant, userId: string): Promise<User | null> {
    const db = this.databases.forTenant(tenant.id);
    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row) return null;
    // Roles and permissions are resolved per request (revocations, expiries and new grants apply at once): active
    // assignments only, custom permissions of the institution included (docs/plans/15 §5.1).
    const access = await memberAccess(db, userId);
    // Clients act on their own resources only; they never hold institution permissions.
    const permissions = row.kind === 'member' ? access.permissions : [];
    return { ...toTenantUser(row, tenant, access.roleKeys, permissions), ...(row.kind === 'member' ? { attributes: row.attributes ?? {} } : {}) };
  }

  async loadStaffUser(userId: string): Promise<User | null> {
    const [row] = await this.databases.platform.select().from(platformUsers).where(eq(platformUsers.id, userId)).limit(1);
    if (!row || row.status !== 'active') return null;
    return {
      userId: row.id,
      kind: 'staff',
      email: row.email,
      name: row.name,
      status: row.status,
      loginIds: [row.email],
      createTime: row.createdAt.getTime(),
      userTenants: [],
      platformRoles: row.roles,
      permissions: resolvePlatformPermissions(row.roles),
    };
  }

  // --- helpers ------------------------------------------------------------------------------------------------------

  private async sessionForTenantUser(tenant: Tenant, row: UserRow): Promise<Session> {
    const user = await this.loadTenantUser(tenant, row.id);
    return this.session({ sub: row.id, kind: row.kind, email: row.email, tid: tenant.id, tdom: tenant.domain }, tenant.id, user);
  }

  private async session(claims: SessionClaims, tenantId: string | null, user: User | null): Promise<Session> {
    if (!user) throw new AuthError('User not found');
    const { session, refreshToken } = await this.sessions.create({ kind: claims.kind, userId: claims.sub, tenantId });
    const { token, expiresAt } = await this.tokens.issue({ ...claims, sid: session.sid });
    return { token, expiresAt, refreshToken, user };
  }
}

export const toTenantUser = (row: UserRow, tenant: Tenant, roleKeys: string[], permissions: string[]): User => ({
  userId: row.id,
  kind: row.kind,
  email: row.email,
  name: row.name,
  givenName: row.givenName ?? undefined,
  familyName: row.familyName ?? undefined,
  picture: row.picture ?? undefined,
  status: row.status,
  loginIds: [row.email],
  createTime: row.createdAt.getTime(),
  // Descope used the tenant key as tenant id; services compare against `tenant.domain`, so keep that convention.
  userTenants: [{ tenantId: tenant.domain, tenantName: tenant.name, roleNames: roleKeys }],
  permissions,
});
