import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus, type Session } from '../../support/api';
import { DEFAULT_PASSWORD, acceptInvitation, acceptInvitationResponse, login, staffSession, uniqueEmail, uniqueKey } from '../../support/factories';
import { PLATFORM_ROLES } from '../../support/catalog';
import { totp } from '../../support/totp';
import { env } from '../../support/env';

async function inviteStaff(role: string): Promise<Session & { email: string }> {
  const email = uniqueEmail(role, 'fintivio.local');
  const since = Date.now() - 1000;
  const res = await Api.as(await staffSession()).post('/platform/staff', { email, name: role, roles: [role] });
  expectStatus(res, 201);
  return { ...(await acceptInvitation({ tenant: null, email, since })), email };
}

test.describe('STAFF-06 Manage platform staff and their roles', { tag: ['@staff', '@STAFF-06'] }, () => {
  test('the platform roles are defined', async () => {
    const res = await Api.as(await staffSession()).get('/platform/roles');
    expectStatus(res, 200);
    expect((res.body as any[]).map((r) => r.id).sort()).toEqual([...PLATFORM_ROLES].sort());
  });

  test('customer success can onboard institutions; support cannot', async () => {
    const cs = await inviteStaff('customer_success');
    const support = await inviteStaff('support');
    const key = uniqueKey();
    expectForbidden(await Api.as(support).post('/tenants', { name: 'x', domain: key, invitee: [] }));
    try {
      expectStatus(await Api.as(cs).post('/tenants', { name: 'x', domain: key, invitee: [] }), 201);
    } finally {
      // Offboard it again (suspend, then delete), like every institution the suite creates.
      const staff = Api.as(await staffSession());
      await staff.put(`/tenants/${key}`, { data: { status: 'suspended' } });
      await staff.delete(`/tenants/${key}`);
    }
  });

  test('staff roles cannot be granted by staff who are not platform admins', async () => {
    const support = await inviteStaff('support');
    expectForbidden(await Api.as(support).post('/platform/staff', { email: uniqueEmail('x', 'fintivio.local'), name: 'x', roles: ['platform_admin'] }));
  });
});

test.describe('STAFF-07 Platform audit log', { tag: ['@staff', '@STAFF-07'] }, () => {
  test('onboarding and suspending an institution are audited with the acting staff member', async () => {
    const staff = Api.as(await staffSession());
    const key = uniqueKey();
    expectStatus(await staff.post('/tenants', { name: 'Audited', domain: key, invitee: [] }), 201);
    expectStatus(await staff.put(`/tenants/${key}`, { data: { status: 'suspended' } }), 200);
    const audit = await staff.get(`/platform/audit?tenant=${key}`);
    expectStatus(audit, 200);
    const entries = audit.body as any[];
    expect(entries.map((e) => e.action)).toEqual(expect.arrayContaining(['tenant.created', 'tenant.suspended']));
    expect(entries.every((e) => e.actor.email === env.staff.email)).toBe(true);
    await staff.delete(`/tenants/${key}`);
  });
});

test.describe('STAFF-01 Platform staff use MFA', { tag: ['@staff', '@STAFF-01'] }, () => {
  test('staff without a second factor must enrol TOTP, then sign-in requires a code', async () => {
    const email = uniqueEmail('support', 'fintivio.local');
    const since = Date.now() - 1000;
    expectStatus(await Api.as(await staffSession()).post('/platform/staff', { email, name: 'support', roles: ['support'] }), 201);
    const staffMember = { email };
    // Choosing the password leads to the enrolment: staff never get a session without a second factor.
    const first = await acceptInvitationResponse({ tenant: null, email, since });
    expectStatus(first, 200);
    expect(first.body.mfaEnrollmentRequired).toBe(true);
    expect(first.body.token).toBeUndefined();

    const enrol = await Api.anonymous().post('/auth/mfa/totp/enroll', { enrollmentToken: first.body.enrollmentToken });
    expectStatus(enrol, 200);
    const confirm = await Api.anonymous().post('/auth/mfa/totp/confirm', { enrollmentToken: first.body.enrollmentToken, code: totp(enrol.body.secret) });
    expectStatus(confirm, 200);
    expect(confirm.body.recoveryCodes.length).toBeGreaterThanOrEqual(8);

    const second = await login(null, staffMember.email, DEFAULT_PASSWORD);
    expect(second.body.mfaRequired).toBe(true);
    const verified = await Api.anonymous().post('/auth/mfa/verify', { mfaToken: second.body.mfaToken, code: totp(enrol.body.secret) });
    expectStatus(verified, 200);
    expect(verified.body.token).toBeTruthy();
  });
});
