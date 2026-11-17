import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { acceptInvitationResponse, addMember, createTenant, deleteTenant, login, uniqueEmail, type TenantHandle } from '../../support/factories';
import { totp } from '../../support/totp';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('FIA-08 Security policy', { tag: ['@fi-admin', '@FIA-08'] }, () => {
  test('new institutions require MFA for members by default', async () => {
    const policy = await bank.adminApi.get('/security/policy');
    expectStatus(policy, 200);
    expect(policy.body.requireMfa).toBe(true);
  });

  test('with requireMfa, members enrol TOTP and then need a code to sign in', async () => {
    expectStatus(await bank.adminApi.put('/security/policy', { requireMfa: true }), 200);
    const email = uniqueEmail('mfa-member', `${bank.key}.example`);
    const since = Date.now() - 1000;
    expectStatus(await bank.adminApi.post('/users', { email, name: 'MFA Member', roleIds: ['reviewer'] }), [200, 201]);
    const member = { email };

    // Activating the account (the password step) leads to the enrolment, not to a session.
    const first = await acceptInvitationResponse({ tenant: bank.key, email, since });
    expectStatus(first, 200);
    expect(first.body.mfaEnrollmentRequired).toBe(true);
    expect(first.body.token).toBeUndefined();

    const enrol = await Api.anonymous(bank.key).post('/auth/mfa/totp/enroll', { enrollmentToken: first.body.enrollmentToken });
    expectStatus(enrol, 200);
    expect(enrol.body.otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expectStatus(await Api.anonymous(bank.key).post('/auth/mfa/totp/confirm', { enrollmentToken: first.body.enrollmentToken, code: totp(enrol.body.secret) }), 200);

    const second = await login(bank.key, member.email);
    expect(second.body).toMatchObject({ mfaRequired: true });
    expectStatus(await Api.anonymous(bank.key).post('/auth/mfa/verify', { mfaToken: second.body.mfaToken, code: '000000' }), 401);
    const verified = await Api.anonymous(bank.key).post('/auth/mfa/verify', { mfaToken: second.body.mfaToken, code: totp(enrol.body.secret) });
    expectStatus(verified, 200);
    expect(verified.body.token).toBeTruthy();
  });

  test('only security:manage holders change the policy', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    expectStatus(await Api.as(member).put('/security/policy', { requireMfa: false }), 403);
  });
});

test.describe('FIA-08 Without the policy', { tag: ['@fi-admin', '@FIA-08'] }, () => {
  test('when the institution turns requireMfa off, members without a factor sign in with their password only', async () => {
    const other = await createTenant();
    try {
      expectStatus(await other.adminApi.put('/security/policy', { requireMfa: false }), 200);
      const email = uniqueEmail('no-mfa', `${other.key}.example`);
      const since = Date.now() - 1000;
      expectStatus(await other.adminApi.post('/users', { email, name: 'No MFA', roleIds: ['reviewer'] }), [200, 201]);
      const accepted = await acceptInvitationResponse({ tenant: other.key, email, since });
      expect(accepted.body.token).toBeTruthy();
      const audit = await other.adminApi.get('/audit?action=security.policy_changed');
      expect(JSON.stringify(audit.body)).toContain('requireMfa');
    } finally {
      await deleteTenant(other);
    }
  });
});
