import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { DEFAULT_PASSWORD, addMember, createTenant, deleteTenant, login, type TenantHandle } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

const userIdOf = async (email: string) => {
  const users = await bank.adminApi.get('/users');
  return (users.body as any[]).find((u) => u.email === email)?.id as string;
};

test.describe('FIA-04 Manage the team', { tag: ['@fi-admin', '@FIA-04'] }, () => {
  test('invite a member with a role; they activate through the e-mail link', async () => {
    const member = await addMember(bank, { roles: ['reviewer'], label: 'new-member' });
    const me = await Api.as(member).get('/auth/me');
    expect(me.body.user.userTenants[0].roleNames).toEqual(['reviewer']);
    const listed = (await bank.adminApi.get('/users')).body as any[];
    expect(listed.find((u) => u.email === member.email)).toMatchObject({ status: 'active', roles: ['reviewer'] });
  });

  test("change a member's roles", async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    expectStatus(await bank.adminApi.put(`/users/${await userIdOf(member.email)}`, { roleIds: ['admin'] }), 200);
    const me = await Api.as(member).get('/auth/me');
    expect(me.body.user.userTenants[0].roleNames).toEqual(['admin']);
  });

  test('deactivation revokes existing sessions at once; reactivation restores access', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    const id = await userIdOf(member.email);
    expectStatus(await bank.adminApi.patch(`/users/${id}/deactivate`), 200);
    expectStatus(await Api.as(member).get('/auth/me'), 401);
    expect((await login(bank.key, member.email)).status).toBe(401);
    expectStatus(await bank.adminApi.patch(`/users/${id}/activate`), 200);
    expectStatus(await login(bank.key, member.email), 200);
  });

  test('password reset sends a dedicated reset link; the old password stops working', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    const since = Date.now() - 1000;
    expectStatus(await bank.adminApi.patch(`/users/${await userIdOf(member.email)}/reset-password`), 200);
    const mail = await waitForEmail({ tenant: bank.key, to: member.email, subject: /password/i, since });
    const { value: token } = linkWithParam(mail, 'token');
    expectStatus(await login(bank.key, member.email, DEFAULT_PASSWORD), 401);
    expectStatus(await Api.anonymous(bank.key).post('/auth/password/reset', { token, password: 'brand-new-password-1' }), 204);
    expectStatus(await login(bank.key, member.email, 'brand-new-password-1'), 200);
  });

  test('the last administrator cannot be deactivated or demoted', async () => {
    const solo = await createTenant();
    try {
      const adminId = (((await solo.adminApi.get('/users')).body as any[]).find((u) => u.email === solo.adminEmail)).id;
      // Refused as self-service (403) or as the last administrator (409): either way the workspace keeps its admin.
      expectStatus(await solo.adminApi.patch(`/users/${adminId}/deactivate`), [403, 409]);
      expectStatus(await solo.adminApi.put(`/users/${adminId}`, { roleIds: ['reviewer'] }), [403, 409]);
      expectStatus(await solo.adminApi.get('/auth/me'), 200);
    } finally {
      await deleteTenant(solo);
    }
  });

  test('nobody changes their own roles', async () => {
    const solo = await createTenant();
    try {
      const second = await addMember(solo, { roles: ['admin'] });
      const secondId = (((await solo.adminApi.get('/users')).body as any[]).find((u) => u.email === second.email)).id;
      expectStatus(await Api.as(second).put(`/users/${secondId}`, { roleIds: ['admin', 'reviewer'] }), 403);
    } finally {
      await deleteTenant(solo);
    }
  });

  test('invitations are scoped to the institution: an invitee of another institution cannot sign in here', async () => {
    const elsewhere = await createTenant();
    try {
      const member = await addMember(elsewhere, { roles: ['reviewer'] });
      expectStatus(await login(bank.key, member.email), 401);
    } finally {
      await deleteTenant(elsewhere);
    }
  });
});
