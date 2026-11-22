import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addClient, addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { waitForTask, decide } from '../../support/scenario';

/**
 * The institution's own back office (docs/plans/16), through the API, with the "Fee waivers" template as the example:
 * BOA-01 the studio (template, publication, versions), BOA-02 gating (pruned per member, refused on use), BOA-03 an
 * action with a staff screen and an approval above the member's authority, BOA-04 data of pages under the member's
 * rights, BOA-05 the access report and preview as roles, BOA-08 read auditing.
 */
let bank: TenantHandle;
let designer: Api;
let rm: Awaited<ReturnType<typeof addMember>>;
let reviewer: Awaited<ReturnType<typeof addMember>>;
let lead: Awaited<ReturnType<typeof addMember>>;
let client: Awaited<ReturnType<typeof addClient>>;
let workflowId: string;

test.beforeAll(async () => {
  bank = await createTenant();
  designer = Api.as(await addMember(bank, { roles: ['flow_designer'], label: 'designer' }));
  rm = await addMember(bank, { roles: ['relationship_manager'], label: 'rm' });
  reviewer = await addMember(bank, { roles: ['reviewer'], label: 'reviewer' });
  lead = await addMember(bank, { roles: ['senior_reviewer'], label: 'lead' });
  client = await addClient(bank, { name: 'Casey Customer' });
  expectStatus(await bank.adminApi.put(`/clients/${client.user.userId}/records/accounts`, {
    records: [{ key: 'cur-1', data: { name: 'Everyday account', type: 'current', number: '•• 1111', balance: 100, currency: 'GBP', status: 'active' } }],
  }), 200);
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe.configure({ mode: 'serial' });

const balance = async () => ((await bank.adminApi.get(`/clients/${client.user.userId}/records/accounts`)).body as Array<{ key: string; balance: number }>).find((r) => r.key === 'cur-1')?.balance;

test.describe('BOA-01 Build the back office in the studio', { tag: ['@flow-designer', '@BOA-01'] }, () => {
  test('a blank draft first; the fee waivers template creates its permission, attribute and workflow, and waits for an administrator', async () => {
    const blank = await designer.get('/backoffice/current');
    expectStatus(blank, 200);
    expect(blank.body).toMatchObject({ activeVersion: null, errors: [], draft: { name: 'Back office', pages: {} } });
    expect(((await designer.get('/backoffice/templates')).body as Array<{ id: string }>).map((t) => t.id)).toEqual(['fee-waivers', 'blank']);

    const installed = await designer.post('/backoffice/current/template', { template: 'fee-waivers' });
    expectStatus(installed, 200);
    workflowId = installed.body.installed.workflow.id;
    // The workflow says who may start it: its publication waits for an administrator; the draft knows it is not published yet.
    expect(installed.body.installed.workflow.publication).toBe('pending_approval');
    expect(installed.body.errors.join(' ')).toContain('which is not published');
    expect(installed.body.installed.nextSteps.join(' ')).toContain('Waive fees');
    // Designers cannot declare member attributes: the template asks an administrator to.
    expect(installed.body.installed.nextSteps.join(' ')).toContain('authorityLimit');
    expectStatus(await bank.adminApi.put('/member-attributes', { attributes: [{ key: 'authorityLimit', label: 'Authority limit (fee waivers)', type: 'number' }] }), 200);
    expectStatus(await designer.post('/backoffice/current/publish'), 422);

    const pending = ((await bank.adminApi.get('/access-changes?status=pending_approval')).body as Array<{ id: string; kind: string }>).find((c) => c.kind === 'workflow.publish')!;
    expectStatus(await bank.adminApi.post(`/access-changes/${pending.id}/approve`), 200);
    const published = await designer.post('/backoffice/current/publish');
    expectStatus(published, 200);
    expect(published.body).toMatchObject({ activeVersion: 1, errors: [] });
  });

  test('the studio refuses what cannot work, and only back-office designers edit it', async () => {
    const broken = await designer.post('/backoffice/current/validate', {
      definition: {
        navigation: [{ section: 'Servicing', label: 'Ghost', page: 'nowhere' }],
        pages: { p: { title: 'P', widgets: [{ id: 'w', type: 'hero', props: {} }, { id: 'x', type: 'list', props: { source: 'records:accounts', journey: 'nope' } }] } },
        actions: { a: { label: 'A', workflowId, context: 'client', access: { permissions: ['custom:unknown'] } } },
      },
    });
    expect(broken.body.errors).toEqual(expect.arrayContaining([
      'menu "Ghost" opens the unknown page "nowhere"',
      'page "p", widget "hero": "hero" is not a back-office widget',
      'page "p", widget "list" runs the unknown action "nope"',
      'action "A": unknown permission "custom:unknown"',
    ]));
    expectForbidden(await Api.as(rm).put('/backoffice/current/draft', { definition: { name: 'Mine' } }));
    expectForbidden(await Api.as(rm).get('/backoffice/current'));
  });
});

test.describe('BOA-02 Each member gets only what their access allows', { tag: ['@fi-admin', '@BOA-02'] }, () => {
  test('before anyone holds "Waive fees", members get nothing of it; once granted, holders get the menu, pages, button and tab', async () => {
    const empty = (await Api.as(rm).get('/backoffice/app')).body;
    expect(empty).toMatchObject({ available: true, definition: { navigation: [], pages: {}, actions: {}, slots: { client: { actions: [], tabs: [] }, dashboard: [] } } });
    // Administrators hold every custom permission.
    expect(Object.keys((await bank.adminApi.get('/backoffice/app')).body.definition.pages).sort()).toEqual(['client-servicing', 'servicing']);

    for (const role of ['relationship_manager', 'senior_reviewer']) expectStatus(await bank.adminApi.put(`/roles/${role}`, { customPermissions: ['custom:fees.waive'] }), 200);
    const app = (await Api.as(rm).get('/backoffice/app')).body.definition;
    expect(app.navigation).toEqual([expect.objectContaining({ label: 'Servicing desk', page: 'servicing' })]);
    expect(Object.keys(app.actions)).toEqual(['waive_fee']);
    expect(app.slots.client).toMatchObject({ actions: [{ action: 'waive_fee' }], tabs: [{ page: 'client-servicing', label: 'Servicing' }] });
    expect(app.slots.dashboard).toHaveLength(1);

    // A reviewer: the definition they get does not even name the pages; using them is refused.
    const theirs = (await Api.as(reviewer).get('/backoffice/app')).body.definition;
    expect(JSON.stringify(theirs)).not.toContain('Servicing desk');
    expect(JSON.stringify(theirs)).not.toContain('waive_fee');
    expectStatus(await Api.as(reviewer).post('/backoffice/data', { page: 'servicing' }), 404);
    expectStatus(await Api.as(reviewer).post('/backoffice/actions/waive_fee', { context: { client: client.user.userId } }), 404);
  });
});

test.describe('BOA-03 An action runs a workflow with staff screens and an approval above the member\'s authority', { tag: ['@relationship-manager', '@BOA-03'] }, () => {
  test('within the authority limit: the member fills the screen, the fee is refunded, the client is told', async () => {
    expectStatus(await bank.adminApi.patch(`/users/${rm.user.userId}/attributes`, { authorityLimit: 50 }), 200);
    const started = await Api.as(rm).post('/backoffice/actions/waive_fee', { context: { client: client.user.userId } });
    expectStatus(started, 201);
    expect(started.body).toMatchObject({ state: 'screen', screen: { title: 'Waive a fee for Casey Customer' } });
    const screen = started.body.screen;
    expect(screen.fields.find((f: { key: string }) => f.key === 'account').options).toEqual([{ value: 'cur-1', label: 'Everyday account · •• 1111' }]);
    // Left half-way, the screen waits for its member (who has no task list) — and only for them.
    expect((await Api.as(rm).get('/backoffice/screens')).body).toEqual([expect.objectContaining({ taskId: screen.taskId, title: 'Waive a fee for Casey Customer', case: expect.objectContaining({ id: started.body.case.id }) })]);
    expect((await Api.as(lead).get('/backoffice/screens')).body).toEqual([]);

    // Checked like a client screen: required fields, ranges.
    const invalid = await Api.as(rm).post(`/backoffice/screens/${screen.taskId}`, { event: 'continue', values: { account: 'cur-1', feeType: 'Late payment', amount: 900 } });
    expectStatus(invalid, 422);
    const done = await Api.as(rm).post(`/backoffice/screens/${screen.taskId}`, { event: 'continue', values: { account: 'cur-1', feeType: 'Late payment', amount: 20, reason: 'First late payment in years' } });
    expectStatus(done, 200);
    const caseId = done.body.case.id as string;
    expect((await Api.as(rm).get('/backoffice/screens')).body).toEqual([]);
    await expect.poll(async () => (await Api.as(rm).get(`/backoffice/cases/${caseId}/progress`)).body.case, { timeout: 15_000 }).toMatchObject({ status: 'completed', outcome: 'fee_waived' });
    await expect.poll(balance, { timeout: 15_000 }).toBe(120);
    const transactions = (await bank.adminApi.get(`/clients/${client.user.userId}/records/transactions`)).body as Array<{ description: string; amount: number }>;
    expect(transactions).toEqual([expect.objectContaining({ description: 'Fee refund · Late payment', amount: 20 })]);
    const audit = JSON.stringify((await bank.adminApi.get('/audit?action=backoffice.action_run')).body);
    expect(audit).toContain('waive_fee');
  });

  test('above it: the member waits for a senior reviewer, who cannot be the one who asked; then the refund happens', async () => {
    const started = await Api.as(rm).post('/backoffice/actions/waive_fee', { context: { client: client.user.userId } });
    const sent = await Api.as(rm).post(`/backoffice/screens/${started.body.screen.taskId}`, { event: 'continue', values: { account: 'cur-1', feeType: 'Overdraft fee', amount: 80, reason: 'Bank error' } });
    expectStatus(sent, 200);
    const caseId = sent.body.case.id as string;
    await expect.poll(async () => (await Api.as(rm).get(`/backoffice/cases/${caseId}/progress`)).body.state, { timeout: 15_000 }).toBe('waiting');
    const progress = (await Api.as(rm).get(`/backoffice/cases/${caseId}/progress`)).body;
    expect(progress.waitingFor).toEqual([expect.objectContaining({ queue: 'senior_reviewer' })]);

    const task = await waitForTask(Api.as(lead), caseId, { view: 'queue' });
    expect(task.title).toContain('Approve a fee waiver of 80');
    expectStatus(await Api.as(lead).post(`/tasks/${task.id}/claim`), 200);
    expectStatus(await decide(Api.as(lead), task.id, 'approve', 'agreed'), 200);
    await expect.poll(balance, { timeout: 15_000 }).toBe(200);
    await expect.poll(async () => (await Api.as(rm).get(`/backoffice/cases/${caseId}/progress`)).body.case.outcome, { timeout: 15_000 }).toBe('fee_waived');
  });

  test('the action is refused without the permission, and without a client', async () => {
    expectStatus(await Api.as(rm).post('/backoffice/actions/waive_fee', {}), 400);
    expectStatus(await bank.adminApi.put('/roles/relationship_manager', { customPermissions: [] }), 200);
    expectStatus(await Api.as(rm).post('/backoffice/actions/waive_fee', { context: { client: client.user.userId } }), 404);
    expectStatus(await bank.adminApi.put('/roles/relationship_manager', { customPermissions: ['custom:fees.waive'] }), 200);
  });
});

test.describe('BOA-04 Pages read data under the member\'s rights', { tag: ['@relationship-manager', '@BOA-04'] }, () => {
  test('a client page: the client, their fee waivers and transactions; the servicing desk: every waiver and my tasks', async () => {
    const clientPage = (await Api.as(rm).post('/backoffice/data', { page: 'client-servicing', context: { client: client.user.userId } })).body;
    expect(clientPage.client).toMatchObject({ id: client.user.userId, name: 'Casey Customer' });
    expect((clientPage.cases as Array<{ workflowName: string }>).every((c) => c.workflowName === 'Fee waiver')).toBe(true);
    expect((clientPage.cases as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect((clientPage.records.transactions as Array<{ description: string }>).map((t) => t.description)).toEqual(expect.arrayContaining(['Fee refund · Late payment', 'Fee refund · Overdraft fee']));
    expectStatus(await Api.as(rm).post('/backoffice/data', { page: 'client-servicing' }), 400);

    const desk = (await Api.as(lead).post('/backoffice/data', { page: 'servicing' })).body;
    expect(desk.metrics.tasks).toMatchObject({ mine: expect.any(Number) });
    expect((desk.cases as unknown[]).length).toBeGreaterThanOrEqual(2);
    // The page does not read the client: nothing else comes back.
    expect(desk.client).toBeUndefined();
  });
});

test.describe('BOA-05 Access report and preview as roles', { tag: ['@flow-designer', '@BOA-05'] }, () => {
  test('per role, what it gets from the draft; a preview as a role gets the pruned draft', async () => {
    const report = (await designer.post('/backoffice/current/access-report')).body;
    const byRole = (key: string) => report.roles.find((r: { role: string }) => r.role === key);
    expect(byRole('relationship_manager')).toMatchObject({ menu: ['Servicing desk'], actions: ['Waive a fee'], clientPage: { buttons: ['Waive a fee'], tabs: ['Servicing'] } });
    expect(byRole('reviewer')).toMatchObject({ menu: [], actions: [], pages: [] });
    // The desk's "My tasks" figure is only for members who work tasks: relationship managers do not get an empty one.
    expect(byRole('relationship_manager').warnings).toEqual([]);
    expect(byRole('reviewer').warnings).toEqual([]);
    expect(report.heldByNobody).toEqual([]);
    // A widget reading what a role cannot read, an action whose own rule lets in a role its workflow does not: both said.
    const draft = (await designer.get('/backoffice/current')).body.draft;
    draft.pages.servicing.widgets.push({ id: 'queue', type: 'list', props: { title: 'Queue', source: 'tasks' } });
    draft.actions.waive_fee.access = { roles: ['reviewer', 'relationship_manager'] };
    const strict = (await designer.post('/backoffice/current/access-report', { definition: draft })).body;
    const warnings = (key: string) => strict.roles.find((r: { role: string }) => r.role === key).warnings.join(' ');
    expect(warnings('relationship_manager')).toContain('shows nothing from tasks');
    expect(warnings('reviewer')).toContain("the workflow's start rule excludes this role");
    const preview = (await designer.post('/backoffice/current/preview', { roles: ['reviewer'] })).body;
    expect(preview.definition.navigation).toEqual([]);
    expect(Object.keys((await designer.post('/backoffice/current/preview', { roles: ['senior_reviewer'] })).body.definition.pages).sort()).toEqual(['client-servicing', 'servicing']);
  });
});

test.describe('BOA-08 Who opened which client through the back office', { tag: ['@fi-admin', '@BOA-08'] }, () => {
  test('off by default; once on, opening a client page is recorded', async () => {
    await Api.as(rm).post('/backoffice/data', { page: 'client-servicing', context: { client: client.user.userId } });
    expect(JSON.stringify((await bank.adminApi.get('/audit?action=client.viewed')).body)).not.toContain(rm.email);
    expectStatus(await bank.adminApi.put('/security/policy', { readAudit: true }), 200);
    await Api.as(rm).post('/backoffice/data', { page: 'client-servicing', context: { client: client.user.userId } });
    const audit = JSON.stringify((await bank.adminApi.get('/audit?action=client.viewed')).body);
    expect(audit).toContain(rm.email);
    expect(audit).toContain('client-servicing');
  });
});

test.describe('BOA-07 Versions and rollback', { tag: ['@flow-designer', '@BOA-07'] }, () => {
  test('a second version, then back to the first', async () => {
    const current = (await designer.get('/backoffice/current')).body;
    const draft = { ...current.draft, navigation: [...current.draft.navigation, { section: 'Servicing', label: 'Desk (copy)', page: 'servicing' }] };
    expectStatus(await designer.put('/backoffice/current/draft', { definition: draft }), 200);
    expect((await designer.post('/backoffice/current/publish')).body.activeVersion).toBe(2);
    expect((await bank.adminApi.get('/backoffice/app')).body.definition.navigation).toHaveLength(2);
    expectStatus(await designer.post('/backoffice/current/activate', { version: 1 }), 200);
    expect((await bank.adminApi.get('/backoffice/app')).body.definition.navigation).toHaveLength(1);
    expectForbidden(await Api.as(rm).post('/backoffice/current/activate', { version: 2 }));
  });
});
