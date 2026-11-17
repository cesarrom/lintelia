import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { withOwnerDb } from '../../support/infra';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('FIA-12 Review and export the audit log', { tag: ['@fi-admin', '@FIA-12', '@X-04'] }, () => {
  test('administrative actions are audited with actor and target', async () => {
    const member = await addMember(bank, { roles: ['reviewer'] });
    expectStatus(await bank.adminApi.post('/roles', { name: `Audited role ${Date.now()}`, description: '', permissions: ['cases:read'] }), 201);

    const audit = await bank.adminApi.get('/audit');
    expectStatus(audit, 200);
    const entries = audit.body as any[];
    const invited = entries.find((e) => e.action === 'member.invited' && e.target.email === member.email);
    expect(invited).toBeTruthy();
    expect(invited.actor).toMatchObject({ type: 'member', email: bank.adminEmail });
    expect(entries.some((e) => e.action === 'role.created')).toBe(true);
    expect(entries.some((e) => e.action === 'member.activated' && e.actor.email === member.email)).toBe(true);
  });

  test('the audit log can be exported by holders of audit:export', async () => {
    const exported = await bank.adminApi.get('/audit/export?format=jsonl');
    expectStatus(exported, 200);
    expect(String(exported.body).trim().split('\n').length).toBeGreaterThan(0);
  });

  test('members without audit:read cannot read it', async () => {
    const reviewer = await addMember(bank, { roles: ['reviewer'] });
    expectForbidden(await Api.as(reviewer).get('/audit'));
  });
});

test.describe('X-04 Append-only, tamper-evident audit trail', { tag: ['@cross-cutting', '@X-04'] }, () => {
  test('the application role can insert audit events but never change or delete them', async () => {
    const privileges = await withOwnerDb((sql) => sql`
      select has_table_privilege('fintivio_app', 'audit_events', 'INSERT') as can_insert,
             has_table_privilege('fintivio_app', 'audit_events', 'UPDATE') as can_update,
             has_table_privilege('fintivio_app', 'audit_events', 'DELETE') as can_delete`);
    expect(privileges[0]).toEqual({ can_insert: true, can_update: false, can_delete: false });
  });

  test('entries are hash-chained per institution (each entry commits to the previous one)', async () => {
    const audit = await bank.adminApi.get('/audit?order=asc');
    expectStatus(audit, 200);
    const entries = audit.body as any[];
    expect(entries.length).toBeGreaterThan(1);
    entries.forEach((entry, index) => {
      expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
      if (index > 0) expect(entry.previousHash).toBe(entries[index - 1].hash);
    });
  });
});
