import { test, expect } from '../../support/test';
import { Api, decodeJwt, expectStatus } from '../../support/api';
import { DEFAULT_PASSWORD, addMember, createTenant, deleteTenant, login, signIn, signInResponse, uniqueEmail, type TenantHandle } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('X-03 Session security', { tag: ['@cross-cutting', '@X-03'] }, () => {
  test('logout revokes the session on the server', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    const api = Api.as(member);
    expectStatus(await api.get('/auth/me'), 200);
    expectStatus(await api.post('/auth/logout'), 204);
    expectStatus(await api.get('/auth/me'), 401);
  });

  test('access tokens are short-lived and sessions continue through an HttpOnly refresh cookie', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    const res = await signInResponse(bank.key, member.email);
    expectStatus(res, 200);
    const claims = decodeJwt(res.body.token!);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(15 * 60);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=(Strict|Lax)/i);

    const refreshed = await Api.anonymous(bank.key).withHeaders({ Cookie: cookie.split(';')[0] }).post('/auth/refresh');
    expectStatus(refreshed, 200);
    expect(refreshed.body.token).not.toBe(res.body.token);
  });

  test('repeated failed sign-ins lock the account temporarily', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    for (let i = 0; i < 5; i += 1) expectStatus(await login(bank.key, member.email, 'wrong-password'), 401);
    expectStatus(await login(bank.key, member.email, DEFAULT_PASSWORD), 429);
  });

  test('password reset does not reveal whether an account exists', async () => {
    const unknown = await Api.anonymous(bank.key).post('/auth/password/forgot', { email: uniqueEmail('nobody') });
    const member = await addMember(bank, { roles: ['reviewer'] });
    const since = Date.now() - 1000;
    const known = await Api.anonymous(bank.key).post('/auth/password/forgot', { email: member.email });
    expectStatus(unknown, 202);
    expectStatus(known, 202);
    expect(known.body).toEqual(unknown.body);

    const mail = await waitForEmail({ tenant: bank.key, to: member.email, subject: /password/i, since });
    const { value: token } = linkWithParam(mail, 'token');
    expectStatus(await Api.anonymous(bank.key).post('/auth/password/reset', { token, password: 'reset-password-123' }), 204);
    expectStatus(await login(bank.key, member.email, 'reset-password-123'), 200);
    expectStatus(await Api.anonymous(bank.key).post('/auth/password/reset', { token, password: 'again-password-123' }), [400, 404]);
  });

  test('changing the password ends other sessions', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    const other = Api.as(member);
    const current = await signIn(bank.key, member.email);
    expectStatus(await Api.withToken(current.token, bank.key).post('/auth/password/change', { currentPassword: DEFAULT_PASSWORD, newPassword: 'changed-password-123' }), 204);
    expectStatus(await other.get('/auth/me'), 401);
  });
});
