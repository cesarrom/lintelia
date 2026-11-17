import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { login, staffSession, uniqueKey } from '../../support/factories';
import { idpUser, setUpSsoWith, ssoSignInWithoutBrowser } from '../../support/sso';

/**
 * STAFF-01 (company IdP): platform staff sign in through the company's IdP via the SSO broker; staff accounts are
 * only created by invitation (no just-in-time accounts); once enforced, passwords are refused for the company domain
 * except for break-glass accounts (the seeded staff account keeps password + TOTP).
 */
test.describe('STAFF-01 Staff sign in with the company IdP', { tag: ['@staff', '@STAFF-01'] }, () => {
  test('invited staff sign in through the IdP; unknown people are refused; passwords are refused once enforced', async () => {
    const staff = Api.as(await staffSession());
    const domain = `${uniqueKey('corp')}.fintivio-staff.example`;
    await setUpSsoWith(staff, '/platform/sso', { domain });
    const status = await staff.get('/platform/sso');
    expect(status.body).toMatchObject({ ready: true });

    const email = `ops.engineer@${domain}`;
    expectStatus(await staff.post('/platform/staff', { email, name: 'Ops Engineer', roles: ['support'] }), 201);
    await idpUser(email, { name: 'Ops Engineer' });
    const discovered = await Api.anonymous().get(`/auth/sso/discover?email=${encodeURIComponent(email)}`);
    expect(discovered.body).toMatchObject({ sso: true });
    const back = await ssoSignInWithoutBrowser(discovered.body.redirectUrl, email);
    const session = await Api.anonymous().post('/auth/sso/exchange', { code: back.searchParams.get('sso') });
    expectStatus(session, 200);
    expect(session.body).toMatchObject({ user: { kind: 'staff', email, platformRoles: ['support'] }, tenant: null });

    // Someone from the company without a staff account.
    const stranger = `stranger@${domain}`;
    await idpUser(stranger);
    const refused = await ssoSignInWithoutBrowser((await Api.anonymous().get(`/auth/sso/discover?email=${encodeURIComponent(stranger)}`)).body.redirectUrl, stranger);
    expect(refused.searchParams.get('sso_error')).toMatch(/staff account/);

    expectStatus(await staff.put('/platform/sso/settings', { enforce: true }), 200);
    try {
      const password = await login(null, email, 'whatever-password-1');
      expectStatus(password, 403);
      expect(password.body.error).toBe('sso_required');
    } finally {
      expectStatus(await staff.put('/platform/sso/settings', { enforce: false }), 200);
    }
  });

  test('only platform admins configure staff single sign-on', async () => {
    const bank = Api.anonymous();
    expectStatus(await bank.get('/platform/sso'), 401);
  });
});
