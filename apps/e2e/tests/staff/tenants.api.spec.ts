import { test, expect } from '@playwright/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addClient, createTenant, deleteTenant, login, staffSession, uniqueKey, type TenantHandle } from '../../support/factories';
import { SYSTEM_ROLES } from '../../support/catalog';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('STAFF-02 Onboard a financial institution', { tag: ['@staff', '@STAFF-02'] }, () => {
  test('the invited administrator activates the institution', async () => {
    const me = await Api.as(bank.admin).get('/auth/me');
    expectStatus(me, 200);
    expect(me.body.tenant.domain).toBe(bank.key);
    expect(me.body.user.userTenants[0].roleNames).toEqual(['admin']);
  });

  test('a new institution starts with every system role of the catalogue', async () => {
    const roles = await bank.adminApi.get('/roles');
    expectStatus(roles, 200);
    const systemRoles = (roles.body as any[]).filter((r) => r.isSystem).map((r) => r.id).sort();
    expect(systemRoles).toEqual([...SYSTEM_ROLES].sort());
  });

  test('tenant keys are validated and unique', async () => {
    const staff = Api.as(await staffSession());
    expectStatus(await staff.post('/tenants', { name: 'Bad key', domain: 'Not A Key!', invitee: [] }), 400);
    expectStatus(await staff.post('/tenants', { name: 'Duplicate', domain: bank.key, invitee: [] }), 409);
  });

  test('custom domains come back with the DNS records to create', async () => {
    const staff = Api.as(await staffSession());
    const key = uniqueKey();
    const res = await staff.post('/tenants', { name: 'With domain', domain: key, allowedDomains: [`onboarding.${key}.example`], invitee: [] });
    expectStatus(res, 201);
    expect(res.body.cnameRecords.map((r: any) => r.Name)).toContain(`onboarding.${key}.example`);
    await staff.put(`/tenants/${key}`, { data: { status: 'suspended' } });
    await staff.delete(`/tenants/${key}`);
  });

  test('institution members and clients cannot onboard institutions', async () => {
    const client = await addClient(bank);
    const body = { name: 'Rogue', domain: uniqueKey(), invitee: [] };
    expectForbidden(await bank.adminApi.post('/tenants', body));
    expectForbidden(await Api.as(client).post('/tenants', body));
  });
});

test.describe('STAFF-03 Manage an institution lifecycle', { tag: ['@staff', '@STAFF-03'] }, () => {
  test('suspending locks members out at once; reactivating lets them back in', async () => {
    const staff = Api.as(await staffSession());
    const temp = await createTenant();
    expectStatus(await staff.put(`/tenants/${temp.key}`, { data: { status: 'suspended' } }), 200);
    expectStatus(await temp.adminApi.get('/auth/me'), 401);
    expect((await login(temp.key, temp.adminEmail)).status).not.toBe(200);

    expectStatus(await staff.put(`/tenants/${temp.key}`, { data: { status: 'active' } }), 200);
    expectStatus(await login(temp.key, temp.adminEmail), 200);
    await deleteTenant(temp);
  });

  test('only platform staff change an institution status', async () => {
    await bank.adminApi.put(`/tenants/${bank.key}`, { data: { status: 'suspended' } });
    const tenant = await Api.as(await staffSession()).get(`/tenants?domain=${bank.key}`);
    expect(tenant.body.status).toBe('active');
  });

  test('an active institution cannot be deleted (two-step offboarding: suspend first)', async () => {
    const staff = Api.as(await staffSession());
    const temp = await createTenant();
    expectStatus(await staff.delete(`/tenants/${temp.key}`), 409);
    expectStatus(await temp.adminApi.get('/auth/me'), 200);
    await deleteTenant(temp);
  });
});

test.describe('STAFF-04 No access to institution data by default', { tag: ['@staff', '@STAFF-04'] }, () => {
  for (const path of ['/users', '/roles', '/forms', '/workflows', '/logs', '/reviews']) {
    test(`staff get 403 on ${path} of an institution`, async () => {
      const staff = Api.as(await staffSession(), bank.key);
      expectForbidden(await staff.get(path));
    });
  }
});
