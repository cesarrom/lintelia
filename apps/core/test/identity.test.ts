/**
 * Authentication rules of the local provider (IdentityService): a member/client token is pinned to its tenant,
 * staff never get a tenant, and invalid/disabled identities resolve to anonymous.
 * Requires the local database (`bun run db:start`).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { platformUsers, roles, tenantSecurityPolicies, tenants, userRoles, users } from '../src/entities';
import { currentStep, totpAt } from '../src/auth/mfa';
import type { Session, SignInResult } from '../src/auth/identity.service';
import { provisionTenant } from '../src/tenancy/provisioning';
import { hashPassword } from '../src/auth/passwords';
import { IdentityService } from '../src/auth/identity.service';
import { TenantDirectory } from '../src/services/tenant-directory.service';
import { OutboxEmailProvider } from '../src/providers/email.provider';
import { AuditWriter } from '../src/services/audit.writer';
import { resetTestData, testDatabases } from './support/databases';

const databases = testDatabases();
const identity = new IdentityService(databases, new TenantDirectory(databases.platform), new OutboxEmailProvider('.data/test-outbox'), new AuditWriter(databases));
const PASSWORD = 'correct-horse-battery';
let bankA: typeof tenants.$inferSelect;
let bankB: typeof tenants.$inferSelect;

/** TOTP secrets of second factors enrolled by these tests, by e-mail. */
const totpSecrets = new Map<string, string>();
let lastStep = 0;

/** Sign in and complete the second factor like a person would (enrol on first use, then codes, never twice the same). */
async function completeSignIn(email: string, result: SignInResult): Promise<Session> {
  if ('mfaEnrollmentRequired' in result) {
    const { secret } = await identity.enrollTotp(result.enrollmentToken);
    totpSecrets.set(email.toLowerCase(), secret);
    return identity.confirmTotp(result.enrollmentToken, totpAt(secret, currentStep()));
  }
  if ('mfaRequired' in result) {
    lastStep = Math.max(currentStep(), lastStep + 1);
    return identity.verifyMfa(result.mfaToken, totpAt(totpSecrets.get(email.toLowerCase())!, lastStep));
  }
  return result;
}
const signIn = async (tenant: Parameters<IdentityService['login']>[0], email: string, password: string) => completeSignIn(email, await identity.login(tenant, email, password));

const headers = (values: Record<string, string>) => new Headers(values);
const bearer = (token: string, tenant?: string) => headers({ authorization: `Bearer ${token}`, ...(tenant ? { 'x-tenant': tenant } : {}) });

beforeAll(async () => {
  await resetTestData();
  bankA = await provisionTenant(databases, { name: 'Bank A', domain: 'bank-a', allowedDomains: ['onboarding.bank-a.example'] });
  bankB = await provisionTenant(databases, { name: 'Bank B', domain: 'bank-b' });
  const passwordHash = await hashPassword(PASSWORD);
  const dbA = databases.forTenant(bankA.id);
  const [admin] = await dbA.insert(users).values({ email: 'admin@a.example', passwordHash }).returning();
  const [adminRole] = await dbA.select().from(roles).where(eq(roles.key, 'admin'));
  await dbA.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id });
  await dbA.insert(users).values({ email: 'gone@a.example', passwordHash, status: 'disabled' });
  await databases.platform.insert(platformUsers).values({ email: 'ops@platform.example', passwordHash });
  // Bank A does not require a second factor for members (the default does; see the MFA tests below).
  await dbA.insert(tenantSecurityPolicies).values({ requireMfa: false });
});

afterAll(async () => {
  await databases.close();
});

describe('sign-in', () => {
  test('members sign in against their tenant and get their roles', async () => {
    const session = await signIn(bankA, 'ADMIN@a.example', PASSWORD);
    expect(session.user.userTenants).toEqual([{ tenantId: 'bank-a', tenantName: 'Bank A', roleNames: ['admin'] }]);
  });

  test('the same credentials do not work against another tenant', async () => {
    await expect(signIn(bankB, 'admin@a.example', PASSWORD)).rejects.toThrow('Invalid email or password');
  });

  test('wrong passwords and disabled users are rejected', async () => {
    await expect(signIn(bankA, 'admin@a.example', 'wrong-password')).rejects.toThrow('Invalid email or password');
    await expect(signIn(bankA, 'gone@a.example', PASSWORD)).rejects.toThrow('Invalid email or password');
  });

  test('staff sign in without a tenant; tenant users cannot', async () => {
    const staff = await signIn(null, 'ops@platform.example', PASSWORD);
    expect(staff.user.kind).toBe('staff');
    await expect(signIn(null, 'admin@a.example', PASSWORD)).rejects.toThrow('Invalid email or password');
  });
});

describe('request resolution', () => {
  test('a member token resolves to its tenant by key, platform sub-domain or custom domain', async () => {
    const { token } = await signIn(bankA, 'admin@a.example', PASSWORD);
    for (const requested of [undefined, 'bank-a', 'bank-a.localhost:3001', 'onboarding.bank-a.example']) {
      const auth = await identity.resolve(bearer(token, requested));
      expect(auth.user?.email).toBe('admin@a.example');
      expect(auth.tenant?.id).toBe(bankA.id);
    }
  });

  test("a member token presented to another tenant is anonymous (no cross-tenant access)", async () => {
    const { token } = await signIn(bankA, 'admin@a.example', PASSWORD);
    const auth = await identity.resolve(bearer(token, 'bank-b'));
    expect(auth.claims).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.tenant).toBeNull();
  });

  test('staff tokens never carry a tenant, whatever is requested', async () => {
    const { token } = await signIn(null, 'ops@platform.example', PASSWORD);
    const auth = await identity.resolve(bearer(token, 'bank-a'));
    expect(auth.claims?.kind).toBe('staff');
    expect(auth.tenant).toBeNull();
  });

  test('tampered tokens are anonymous', async () => {
    const { token } = await signIn(bankA, 'admin@a.example', PASSWORD);
    const [header, payload, signature] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const forged = [header, Buffer.from(JSON.stringify({ ...claims, tid: bankB.id, tdom: 'bank-b' })).toString('base64url'), signature].join('.');
    const auth = await identity.resolve(bearer(forged));
    expect(auth.claims).toBeNull();
  });

  test('tokens of users disabled after sign-in stop working', async () => {
    const dbA = databases.forTenant(bankA.id);
    const [temp] = await dbA.insert(users).values({ email: 'temp@a.example', passwordHash: await hashPassword(PASSWORD) }).returning();
    const { token } = await signIn(bankA, 'temp@a.example', PASSWORD);
    await dbA.update(users).set({ status: 'disabled' }).where(eq(users.id, temp.id));
    expect((await identity.resolve(bearer(token))).user).toBeNull();
  });

  test('suspending a tenant locks out its users', async () => {
    const temp = await provisionTenant(databases, { name: 'Temp', domain: 'temp-bank' });
    await databases.forTenant(temp.id).insert(users).values({ email: 'x@temp.example', passwordHash: await hashPassword(PASSWORD) });
    const { token } = await signIn(temp, 'x@temp.example', PASSWORD);
    await databases.platform.update(tenants).set({ status: 'suspended' }).where(eq(tenants.id, temp.id));
    expect((await identity.resolve(bearer(token))).user).toBeNull();
  });

  test('anonymous requests only resolve the requested tenant (for sign-in pages)', async () => {
    const auth = await identity.resolve(headers({ 'x-tenant': 'bank-b.localhost:3001' }));
    expect(auth.claims).toBeNull();
    expect(auth.tenant?.id).toBe(bankB.id);
  });
});

describe('invitations', () => {
  test('an invitation is accepted once, in its own tenant only', async () => {
    const { token } = await identity.createInvitation(databases.forTenant(bankA.id), { email: 'new@a.example', roleKeys: ['reviewer'], invitedBy: 'test' });
    await expect(identity.acceptInvitation(bankB, { token, password: 'a-new-password' })).rejects.toThrow('invalid or has expired');
    await expect(identity.acceptInvitation(bankA, { token, password: 'short' })).rejects.toThrow('at least 10 characters');
    const session = await completeSignIn('new@a.example', await identity.acceptInvitation(bankA, { token, password: 'a-new-password', name: 'New Member' }));
    expect(session.user.userTenants[0].roleNames).toEqual(['reviewer']);
    await expect(identity.acceptInvitation(bankA, { token, password: 'a-new-password' })).rejects.toThrow('invalid or has expired');
  });

  test('inviting with an unknown role fails without creating anything', async () => {
    await expect(identity.createInvitation(databases.forTenant(bankA.id), { email: 'nobody@a.example', roleKeys: ['ghost'], invitedBy: 'test' })).rejects.toThrow('Unknown role(s): ghost');
    const rows = await databases.forTenant(bankA.id).select().from(users).where(eq(users.email, 'nobody@a.example'));
    expect(rows).toEqual([]);
  });
});

describe('second factor', () => {
  test('staff must enrol a second factor before their first session', async () => {
    const passwordHash = await hashPassword(PASSWORD);
    await databases.platform.insert(platformUsers).values({ email: 'new-ops@platform.example', passwordHash });
    const first = await identity.login(null, 'new-ops@platform.example', PASSWORD);
    expect(first).toMatchObject({ mfaEnrollmentRequired: true });
    const { secret, otpauthUri } = await identity.enrollTotp((first as { enrollmentToken: string }).enrollmentToken);
    expect(otpauthUri).toStartWith('otpauth://totp/');
    await expect(identity.confirmTotp((first as { enrollmentToken: string }).enrollmentToken, '000000')).rejects.toThrow('not valid');
    const confirmed = await identity.confirmTotp((first as { enrollmentToken: string }).enrollmentToken, totpAt(secret, currentStep()));
    expect(confirmed.recoveryCodes).toHaveLength(10);

    const second = await identity.login(null, 'new-ops@platform.example', PASSWORD);
    expect(second).toMatchObject({ mfaRequired: true });
    const mfaToken = (second as { mfaToken: string }).mfaToken;
    await expect(identity.verifyMfa(mfaToken, '123456')).rejects.toThrow('not valid');
    const step = currentStep() + 1;
    const session = await identity.verifyMfa(mfaToken, totpAt(secret, step));
    expect(session.user.kind).toBe('staff');

    // The same code cannot be used twice; a recovery code works once.
    const third = await identity.login(null, 'new-ops@platform.example', PASSWORD) as { mfaToken: string };
    await expect(identity.verifyMfa(third.mfaToken, totpAt(secret, step))).rejects.toThrow('not valid');
    expect((await identity.verifyMfa(third.mfaToken, confirmed.recoveryCodes[0])).user.kind).toBe('staff');
    const fourth = await identity.login(null, 'new-ops@platform.example', PASSWORD) as { mfaToken: string };
    await expect(identity.verifyMfa(fourth.mfaToken, confirmed.recoveryCodes[0])).rejects.toThrow('not valid');
  });

  test("members need a second factor when their institution's policy requires it (the default)", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    await databases.forTenant(bankB.id).insert(users).values({ email: 'member@b.example', passwordHash });
    expect(await identity.login(bankB, 'member@b.example', PASSWORD)).toMatchObject({ mfaEnrollmentRequired: true });
    expect((await identity.securityPolicy(bankB.id)).requireMfa).toBe(true);
  });
});
