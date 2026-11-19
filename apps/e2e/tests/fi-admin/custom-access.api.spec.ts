import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { workflowFixture } from '../../support/workflows';
import { waitForTask } from '../../support/scenario';

/**
 * FIA-13: institutions name their own permissions (docs/plans/15 §5.1); nobody holds one until a role does; system
 * roles can be extended with them, never changed otherwise. FIA-14: workflows say who may start them and who may see
 * their cases (§5.3); the rule is enforced through every entry point, and setting it is an administrator's decision.
 */
let bank: TenantHandle;
let designer: Api;
let rm: Api;
let rmSession: Awaited<ReturnType<typeof addMember>>;

test.beforeAll(async () => {
  bank = await createTenant();
  designer = Api.as(await addMember(bank, { roles: ['flow_designer'], label: 'designer' }));
  rmSession = await addMember(bank, { roles: ['relationship_manager'], label: 'rm' });
  rm = Api.as(rmSession);
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe.configure({ mode: 'serial' });

const me = async (api: Api) => (await api.get('/auth/me')).body.user?.permissions ?? (await api.get('/auth/me')).body.permissions;

test.describe('FIA-13 Custom permissions', { tag: ['@fi-admin', '@FIA-13'] }, () => {
  test('a designer names a capability; it joins the catalogue but nobody except administrators holds it', async () => {
    const created = await designer.post('/permissions/custom', { name: 'Waive fees', key: 'custom:fees.waive', category: 'Servicing', description: 'Waive account fees' });
    expectStatus(created, 201);
    expect(created.body).toMatchObject({ id: 'custom:fees.waive', name: 'Waive fees', custom: true, archived: false });
    const catalogue = (await rm.get('/permissions')).body as Array<{ id: string; custom?: boolean }>;
    expect(catalogue.find((p) => p.id === 'custom:fees.waive')).toMatchObject({ custom: true });
    expect(catalogue.some((p) => p.id === 'cases:read')).toBe(true);
    // Nobody holds it yet; the administrator holds every permission, custom ones included.
    expect(await me(designer)).not.toContain('custom:fees.waive');
    expect(await me(bank.adminApi)).toContain('custom:fees.waive');
    // The same key twice, a key that is not custom:, and people who may not create permissions.
    expectStatus(await designer.post('/permissions/custom', { name: 'Waive fees', key: 'custom:fees.waive' }), 409);
    expect((await designer.post('/permissions/custom', { name: 'Other', key: 'cases:read' })).body.id).toBe('custom:cases_read');
    expectForbidden(await rm.post('/permissions/custom', { name: 'Sneaky' }));
  });

  test('designers cannot grant it; an administrator adds it to a system role without touching its platform permissions', async () => {
    expectForbidden(await designer.put('/roles/relationship_manager', { customPermissions: ['custom:fees.waive'] }));
    const extended = await bank.adminApi.put('/roles/relationship_manager', { customPermissions: ['custom:fees.waive'] });
    expectStatus(extended, 200);
    expect(extended.body).toMatchObject({ isSystem: true, customPermissions: ['custom:fees.waive'] });
    expect(extended.body.permissions).toEqual(expect.arrayContaining(['cases:create', 'custom:fees.waive']));
    // Effective on the next request (permissions are resolved per request, not baked into tokens).
    expect(await me(rm)).toContain('custom:fees.waive');

    // The platform's part of a system role stays as it is; names too.
    const role = extended.body as { permissions: string[] };
    expectForbidden(await bank.adminApi.put('/roles/relationship_manager', { permissions: role.permissions.filter((p) => p !== 'cases:create') }));
    expectForbidden(await bank.adminApi.put('/roles/relationship_manager', { name: 'Banker' }));
    expectForbidden(await bank.adminApi.put('/roles/admin', { customPermissions: ['custom:fees.waive'] }));
    expectStatus(await bank.adminApi.put('/roles/relationship_manager', { customPermissions: ['custom:unknown'] }), 400);
    // A custom role can hold it too.
    const custom = await bank.adminApi.post('/roles', { name: 'Fee desk', permissions: ['workspace:read', 'custom:fees.waive'] });
    expectStatus(custom, 201);
    expect(custom.body).toMatchObject({ key: 'fee_desk', customPermissions: ['custom:fees.waive'], members: 0 });
  });

  test('every change is on record, with who asked for it', async () => {
    const changes = (await bank.adminApi.get('/access-changes')).body as Array<{ kind: string; status: string; summary: string; diff: { added?: string[] }; requestedBy: { email: string } }>;
    const extension = changes.find((c) => c.kind === 'role.update' && c.summary.includes('+Waive fees'));
    expect(extension).toMatchObject({ status: 'applied', requestedBy: { email: bank.adminEmail }, diff: { added: ['custom:fees.waive'] } });
    const audit = (await bank.adminApi.get('/audit?action=permission.created')).body;
    expect(JSON.stringify(audit)).toContain('custom:fees.waive');
  });

  test('archiving revokes it everywhere at once; restoring grants it to nobody', async () => {
    expectStatus(await bank.adminApi.delete(`/permissions/custom/${encodeURIComponent('custom:fees.waive')}`), 200);
    expect(await me(rm)).not.toContain('custom:fees.waive');
    const role = (await bank.adminApi.get('/roles/relationship_manager')).body;
    expect(role.customPermissions).toEqual([]);
    const restored = await bank.adminApi.post(`/permissions/custom/${encodeURIComponent('custom:fees.waive')}/restore`);
    expectStatus(restored, 200);
    expect(restored.body.archived).toBe(false);
    expect(await me(rm)).not.toContain('custom:fees.waive');
    // Put back for the next tests.
    expectStatus(await bank.adminApi.put('/roles/relationship_manager', { customPermissions: ['custom:fees.waive'] }), 200);
  });
});

test.describe('FIA-14 Workflows say who may start them and who may see their cases', { tag: ['@fi-admin', '@FIA-14'] }, () => {
  let gatedId: string;

  test('a designer proposes who may start a workflow; an administrator decides', async () => {
    const yaml = `${workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'P1D' }).replace('name: Manual review', 'name: Fee waiver')}
access:
  start: { permissions: ["custom:fees.waive"] }
  cases: { permissions: ["custom:fees.waive"] }
`;
    const created = await designer.post('/workflows', { yaml });
    expectStatus(created, 201);
    gatedId = created.body.id;

    // A mistake in the rule is a publication error.
    const broken = await designer.post('/workflows', { yaml: yaml.replace('custom:fees.waive"] }\n  cases', 'custom:nope"] }\n  cases') });
    const refused = await designer.post(`/workflows/${broken.body.id}/publish`);
    expectStatus(refused, 422);
    expect(refused.body.errors).toContain('Who may start it: unknown permission "custom:nope"');

    // Designers do not decide who may use a workflow: the publication waits for an administrator.
    const pending = await designer.post(`/workflows/${gatedId}/publish`);
    expectStatus(pending, 202);
    expect(pending.body).toMatchObject({ pending: true, status: 'pending_approval', change: { kind: 'workflow.publish' } });
    expect(pending.body.change.summary).toContain('custom:fees.waive');
    expectStatus(await rm.post(`/workflows/${gatedId}/executions`, { inputs: { email: 'a@b.example' } }), 409);

    // The designer cannot approve their own change, nor can anyone without roles:manage.
    expectForbidden(await designer.post(`/access-changes/${pending.body.change.id}/approve`));
    const approved = await bank.adminApi.post(`/access-changes/${pending.body.change.id}/approve`, { reason: 'fee desk only' });
    expectStatus(approved, 200);
    expect(approved.body).toMatchObject({ status: 'applied', approvedBy: bank.adminEmail });
    const versions = (await designer.get(`/workflows/${gatedId}/versions`)).body as Array<{ status: string }>;
    expect(versions.some((v) => v.status === 'active')).toBe(true);
  });

  test('only members the rule allows see it among the workflows they can start, and start it (UI list, API)', async () => {
    const reviewer = await addMember(bank, { roles: ['compliance_officer'], label: 'compliance' });
    const compliance = Api.as(reviewer);
    // Compliance holds cases:create but not the custom permission: not offered, and refused.
    expect(((await compliance.get('/workflows/startable')).body as Array<{ id: string }>).map((w) => w.id)).not.toContain(gatedId);
    expectForbidden(await compliance.post(`/workflows/${gatedId}/executions`, { inputs: { email: 'c@d.example' } }));
    expectForbidden(await compliance.post('/cases', { workflowId: gatedId, inputs: { email: 'c@d.example' } }));
    // The relationship manager holds it (extended role).
    expect(((await rm.get('/workflows/startable')).body as Array<{ id: string }>).map((w) => w.id)).toContain(gatedId);
    const started = await rm.post(`/workflows/${gatedId}/executions`, { inputs: { email: 'e@f.example' } });
    expectStatus(started, 202);

    // Its cases are hidden from members outside the cases rule, even those who see every case; tasks too.
    const caseId = started.body.caseId as string;
    expectStatus(await compliance.get(`/cases/${caseId}`), 404);
    expect(((await compliance.get('/cases')).body as Array<{ id: string }>).map((c) => c.id)).not.toContain(caseId);
    expectStatus(await bank.adminApi.get(`/cases/${caseId}`), 200);
    const task = await waitForTask(bank.adminApi, caseId, { view: 'all' });
    const reviewerMember = Api.as(await addMember(bank, { roles: ['reviewer'], label: 'reviewer' }));
    expect(((await reviewerMember.get('/tasks?view=queue')).body as Array<{ id: string }>).map((t) => t.id)).not.toContain(task.id);
    expectStatus(await reviewerMember.get(`/tasks/${task.id}`), 404);
  });

  test('API clients follow the same rule', async () => {
    const withPermission = await bank.adminApi.post('/api-clients', { name: 'Fee system', permissions: ['custom:fees.waive'] });
    expectStatus(withPermission, 201);
    const without = await bank.adminApi.post('/api-clients', { name: 'Intake system', permissions: ['cases:create'] });
    const token = async (client: { clientId: string; clientSecret: string }) => {
      const res = await fetch(new URL('/oauth/token', process.env.E2E_API_URL ?? 'http://localhost:8000'), {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: client.clientId, client_secret: client.clientSecret }),
      });
      return (await res.json()).access_token as string;
    };
    const allowed = Api.withToken(await token(withPermission.body), bank.key);
    const refused = Api.withToken(await token(without.body), bank.key);
    expectStatus(await allowed.post(`/workflows/${gatedId}/executions`, { inputs: { email: 'g@h.example' } }), 202);
    expectForbidden(await refused.post(`/workflows/${gatedId}/executions`, { inputs: { email: 'g@h.example' } }));
  });
});
