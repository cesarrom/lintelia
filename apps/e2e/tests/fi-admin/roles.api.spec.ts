import { test, expect } from '@playwright/test';
import { Api, expectAllowed, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { SYSTEM_ROLES, TENANT_PERMISSIONS } from '../../support/catalog';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

const uniqueRoleName = (label: string) => `${label} ${Date.now().toString(36)}`;

test.describe('FIA-05 Define custom roles from the permission catalogue', { tag: ['@fi-admin', '@FIA-05'] }, () => {
  test('the permission catalogue is published', async () => {
    const res = await bank.adminApi.get('/permissions');
    expectStatus(res, 200);
    expect((res.body as any[]).map((p) => p.id)).toEqual(expect.arrayContaining([...TENANT_PERMISSIONS]));
    expect((res.body as any[]).every((p) => p.name && p.description && p.category)).toBe(true);
  });

  test('system roles are listed and cannot be changed or deleted', async () => {
    const roles = await bank.adminApi.get('/roles');
    const system = (roles.body as any[]).filter((r) => r.isSystem).map((r) => r.id);
    expect(system.sort()).toEqual([...SYSTEM_ROLES].sort());
    expectStatus(await bank.adminApi.put('/roles/reviewer', { permissions: ['audit:read'] }), [400, 403, 409]);
    expectStatus(await bank.adminApi.delete('/roles/admin'), [400, 403, 409]);
  });

  test('custom roles only accept catalogue permissions', async () => {
    const res = await bank.adminApi.post('/roles', { name: uniqueRoleName('Bad'), description: '', permissions: ['cases:read', 'bank:rob'] });
    expectStatus(res, 400);
  });

  test('a custom role grants exactly its permissions', async () => {
    const name = uniqueRoleName('KYC lead');
    const created = await bank.adminApi.post('/roles', { name, description: 'Team lead without workspace admin', permissions: ['workspace:read', 'cases:read', 'tasks:work', 'tasks:assign'] });
    expectStatus(created, 201);
    const lead = await addMember(bank, { roles: [created.body.id] });
    const me = await Api.as(lead).get('/auth/me');
    expect([...me.body.permissions].sort()).toEqual(['cases:read', 'tasks:assign', 'tasks:work', 'workspace:read']);
    expectAllowed(await Api.as(lead).get('/tasks?view=all'));
    expectForbidden(await Api.as(lead).get('/users'));
  });

  test('nobody can create or assign roles with permissions they do not hold (no privilege escalation)', async () => {
    const peopleManager = await bank.adminApi.post('/roles', {
      name: uniqueRoleName('People manager'),
      description: '',
      permissions: ['workspace:read', 'members:read', 'members:invite', 'members:update', 'roles:read', 'roles:manage'],
    });
    expectStatus(peopleManager, 201);
    const manager = await addMember(bank, { roles: [peopleManager.body.id] });
    const api = Api.as(manager);

    expectForbidden(await api.post('/roles', { name: uniqueRoleName('Escalated'), description: '', permissions: ['integrations:manage'] }));
    expectForbidden(await api.post('/users', { email: `x${Date.now()}@e2e.example`, name: 'x', roleIds: ['admin'] }));
    expectStatus(await api.post('/roles', { name: uniqueRoleName('Viewer'), description: '', permissions: ['members:read'] }), 201);
  });
});
