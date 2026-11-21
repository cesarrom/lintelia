import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Api, expectStatus, type ApiResponse, type Session, type SignInResponse } from './api';
import { env, tenantHost, tenantUrl } from './env';
import { linkWithParam, waitForEmail } from './mailbox';
import { totp } from './totp';

export const DEFAULT_PASSWORD = 'e2e-Password-1234';

/** Unique, valid tenant key / e-mail local part. */
export const uniqueKey = (prefix = 'e2e') => `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

export const uniqueEmail = (label: string, domain = 'e2e.example') => `${label}.${randomBytes(4).toString('hex')}@${domain}`;

// --- second factor ---------------------------------------------------------------------------------------------------

/** TOTP secrets of the accounts this process enrolled (members and staff need a second factor, docs/plans/02). */
const totpSecrets = new Map<string, string>([[env.staff.email.toLowerCase(), env.staff.totpSecret]]);
export const totpSecretOf = (email: string) => totpSecrets.get(email.toLowerCase());
export const rememberTotpSecret = (email: string, secret: string) => totpSecrets.set(email.toLowerCase(), secret);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Finish a password sign-in like a person with an authenticator app: enrol on first use (the secret is remembered),
 * otherwise type the current code. A code is accepted once (RFC 6238 replay protection): when another sign-in of the
 * same account used it already, wait for the next 30-second window.
 */
export async function completeSignIn(tenant: string | null, email: string, response: ApiResponse<SignInResponse>): Promise<Session> {
  return (await completeSignInResponse(tenant, email, response)).body;
}

/** Like completeSignIn, with the final HTTP response (its refresh cookie). */
export async function completeSignInResponse(tenant: string | null, email: string, response: ApiResponse<SignInResponse>): Promise<ApiResponse<Session>> {
  expectStatus(response, 200);
  const body = response.body;
  if (body.mfaEnrollmentRequired) {
    const api = Api.anonymous(tenant);
    const enrol = await api.post('/auth/mfa/totp/enroll', { enrollmentToken: body.enrollmentToken });
    expectStatus(enrol, 200);
    totpSecrets.set(email.toLowerCase(), enrol.body.secret);
    const confirmed = await api.post<Session>('/auth/mfa/totp/confirm', { enrollmentToken: body.enrollmentToken, code: totp(enrol.body.secret) });
    expectStatus(confirmed, 200);
    return confirmed;
  }
  if (body.mfaRequired) {
    const secret = totpSecretOf(email);
    if (!secret) throw new Error(`No TOTP secret known for ${email}: it was enrolled outside this test process`);
    for (let attempt = 0; attempt < 3; attempt++) {
      const verified = await Api.anonymous(tenant).post<Session>('/auth/mfa/verify', { mfaToken: body.mfaToken, code: totp(secret) });
      if (verified.status === 200) return verified;
      await sleep(30_000 - (Date.now() % 30_000) + 200);
    }
    throw new Error(`Second factor refused for ${email}`);
  }
  return response as ApiResponse<Session>;
}

/** Password sign-in including the second factor. */
export async function signIn(tenant: string | null, email: string, password = DEFAULT_PASSWORD): Promise<Session> {
  return completeSignIn(tenant, email, await login(tenant, email, password));
}

/** Password sign-in including the second factor, returning the final HTTP response. */
export async function signInResponse(tenant: string | null, email: string, password = DEFAULT_PASSWORD) {
  return completeSignInResponse(tenant, email, await login(tenant, email, password));
}

let staff: { session: Session; at: number } | null = null;
export const STAFF_SESSION_FILE = join(import.meta.dirname, '../.auth/staff-session.json');

/**
 * The seeded platform staff account. The global setup signs in once (password + TOTP) and shares the session through
 * a file: many parallel sign-ins of one account would collide on its one-time codes. Re-signs in when it gets old.
 */
export async function staffSession(): Promise<Session> {
  if (!staff && existsSync(STAFF_SESSION_FILE)) staff = JSON.parse(readFileSync(STAFF_SESSION_FILE, 'utf8'));
  if (staff && Date.now() - staff.at < 12 * 60_000) return staff.session;
  const session = await signIn(null, env.staff.email, env.staff.password);
  staff = { session, at: Date.now() };
  mkdirSync(dirname(STAFF_SESSION_FILE), { recursive: true });
  writeFileSync(STAFF_SESSION_FILE, JSON.stringify(staff));
  return session;
}

/** Accept the newest invitation e-mail sent to `email`; the raw answer (a session, or a second-factor step). */
export async function acceptInvitationResponse(opts: { tenant: string | null; email: string; since: number; password?: string; name?: string }) {
  const mail = await waitForEmail({ tenant: opts.tenant, to: opts.email, subject: /invit|Invit/, since: opts.since });
  const { value: token } = linkWithParam(mail, 'invitation');
  return Api.anonymous(opts.tenant).post<SignInResponse>('/auth/invitations/accept', {
    token,
    password: opts.password ?? DEFAULT_PASSWORD,
    name: opts.name ?? opts.email.split('@')[0],
  });
}

/** Accept the newest invitation e-mail sent to `email` and return the resulting session (enrolling a second factor when required). */
export async function acceptInvitation(opts: { tenant: string | null; email: string; since: number; password?: string; name?: string }): Promise<Session> {
  return completeSignIn(opts.tenant, opts.email, await acceptInvitationResponse(opts));
}

export interface TenantHandle {
  key: string;
  host: string;
  url: (path?: string) => string;
  tenant: { id: string; domain: string; name: string };
  admin: Session;
  adminEmail: string;
  /** API client acting as the tenant administrator. */
  adminApi: Api;
}

/**
 * Onboard a fresh institution the way platform staff do (STAFF-02) and activate its first administrator through
 * the invitation e-mail (FIA-01). Every test file gets its own tenant, so files can run in parallel.
 */
export async function createTenant(opts: { name?: string; key?: string } = {}): Promise<TenantHandle> {
  const staff = await staffSession();
  const key = opts.key ?? uniqueKey();
  const adminEmail = opts.name ? `olivia.owner@${key}.example` : uniqueEmail('admin', `${key}.example`);
  const since = Date.now() - 1000;
  const created = await Api.as(staff).post('/tenants', {
    name: opts.name ?? `E2E ${key}`,
    domain: key,
    invitee: [{ email: adminEmail, role: 'admin' }],
  });
  expectStatus(created, 201);
  const admin = await acceptInvitation({ tenant: key, email: adminEmail, since, ...(opts.name ? { name: 'Olivia Owner' } : {}) });
  return {
    key,
    host: tenantHost(key),
    url: (path = '/') => tenantUrl(key, path),
    tenant: created.body,
    admin,
    adminEmail,
    adminApi: Api.as(admin),
  };
}

/** Remove a tenant created by a test. Suspends first (deletion of active tenants is expected to be refused). */
export async function deleteTenant(handle: TenantHandle | undefined) {
  if (!handle) return;
  const staff = Api.as(await staffSession());
  await staff.put(`/tenants/${handle.key}`, { data: { status: 'suspended' } });
  await staff.delete(`/tenants/${handle.key}`);
}

/** Invite a member with the given role keys and activate the account through the e-mail link. */
export async function addMember(handle: TenantHandle, opts: { roles: string[]; label?: string; inviter?: Session }): Promise<Session & { email: string }> {
  const email = uniqueEmail(opts.label ?? opts.roles.join('-') ?? 'member', `${handle.key}.example`);
  const since = Date.now() - 1000;
  const res = await Api.as(opts.inviter ?? handle.admin).post('/users', { email, name: opts.label ?? email, roleIds: opts.roles });
  expectStatus(res, [200, 201]);
  const session = await acceptInvitation({ tenant: handle.key, email, since });
  return { ...session, email };
}

/** Self-registered client (end user) of the tenant. */
export async function addClient(handle: TenantHandle, opts: { label?: string; name?: string } = {}): Promise<Session & { email: string }> {
  const label = (opts.label ?? opts.name ?? 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const email = uniqueEmail(label, 'customers.example');
  const res = await Api.anonymous(handle.key).post<Session>('/auth/register', { email, password: DEFAULT_PASSWORD, name: opts.name ?? opts.label ?? 'E2E Client' });
  expectStatus(res, 201);
  return { ...res.body, email };
}

export async function login(tenant: string | null, email: string, password = DEFAULT_PASSWORD) {
  return Api.anonymous(tenant).post<SignInResponse>('/auth/login', { email, password });
}
