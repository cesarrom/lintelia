import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { createTenant, deleteTenant, staffSession, uniqueEmail, type TenantHandle } from '../../support/factories';

/**
 * STAFF-05 / FIA-11: platform staff only see institution data through a grant the institution approves
 * (modelled on Microsoft Customer Lockbox / Google Access Approval).
 */
let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('STAFF-05 Time-bound, institution-approved support access', { tag: ['@staff', '@STAFF-05', '@FIA-11'] }, () => {
  test('without a grant, staff cannot read institution data', async () => {
    expectForbidden(await Api.as(await staffSession(), bank.key).get('/users'));
  });

  test('request, approval, read-only use, revocation and audit', async () => {
    const staffSess = await staffSession();
    const staff = Api.as(staffSess, bank.key);

    const requested = await Api.as(staffSess).post('/platform/support-access', {
      tenant: bank.key,
      reason: 'Ticket 4711: failed workflow executions',
      scope: 'read',
      durationMinutes: 30,
    });
    expectStatus(requested, 201);
    expect(requested.body.status).toBe('pending');
    expectForbidden(await staff.get('/users'));

    const pending = await bank.adminApi.get('/support-access');
    expectStatus(pending, 200);
    expect((pending.body as any[]).map((r) => r.id)).toContain(requested.body.id);
    expectStatus(await bank.adminApi.post(`/support-access/${requested.body.id}/approve`), 200);

    expectStatus(await staff.get('/users'), 200);
    expectForbidden(await staff.post('/users', { email: uniqueEmail('nope'), name: 'x', roleIds: [] }));

    expectStatus(await bank.adminApi.post(`/support-access/${requested.body.id}/revoke`), 200);
    expectForbidden(await staff.get('/users'));

    const audit = await bank.adminApi.get('/audit');
    expectStatus(audit, 200);
    const actions = (audit.body as any[]).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['support_access.requested', 'support_access.granted', 'support_access.used', 'support_access.revoked']));
    // Every use is attributed to the staff member.
    const uses = (await bank.adminApi.get('/audit?action=support_access.used')).body as any[];
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.every((e) => e.actor.type === 'staff' && e.actor.email === staffSess.user.email)).toBe(true);
  });

  test('members without support_access:approve cannot approve grants', async () => {
    const staffSess = await staffSession();
    const requested = await Api.as(staffSess).post('/platform/support-access', { tenant: bank.key, reason: 'x', scope: 'read', durationMinutes: 10 });
    expectStatus(requested, 201);
    const client = await Api.anonymous(bank.key).post('/auth/register', { email: uniqueEmail('c'), password: 'a-long-password-1' });
    expectForbidden(await Api.as(client.body).post(`/support-access/${requested.body.id}/approve`));
  });
});
