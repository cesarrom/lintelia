import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addClient, deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { appClient, installBankingApp, type InstalledApp } from '../../support/client-app';
import { minimalWorkflowYaml } from '../../support/workflows';

test.describe.configure({ timeout: 120_000 });

let inst: Institution;
let designer: Api;
let installed: InstalledApp | undefined;
/** Installed by the second test (after the blank state is checked), or on demand when a retry starts a fresh worker. */
const bankingApp = async () => (installed ??= await installBankingApp(designer));

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer', integrations: 'integration_manager', auditor: 'auditor' } });
  designer = Api.as(inst.members.designer);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('APP-01 Build the client app from a template', { tag: ['@designer', '@APP-01'] }, () => {
  test('a blank draft exists on first visit; clients get the classic portal until an app is published', async () => {
    const current = await designer.get('/client-apps/current');
    expectStatus(current, 200);
    expect(current.body.activeVersion).toBeNull();
    expect(Object.keys(current.body.draft.pages)).toEqual(expect.arrayContaining(['home', 'activity', 'profile']));
    const client = await addClient(inst.bank, { name: 'Early Client' });
    const mine = await Api.as(client).get('/me/app');
    expectStatus(mine, 200);
    expect(mine.body.available).toBe(false);
  });

  test('the banking template creates and publishes its journey workflows; the designer publishes the app', async () => {
    const app = await bankingApp();
    expect(app.version).toBe(1);
    expect(Object.keys(app.journeys)).toEqual(expect.arrayContaining(['open_current', 'transfer', 'card_freeze', 'personal_loan', 'contact_us']));
    const workflows = await designer.get('/workflows');
    const names = (workflows.body as any[]).map((w) => w.name);
    expect(names).toEqual(expect.arrayContaining(['App: move money', 'App: open your first account', 'App: welcome new clients']));
    const audit = await inst.bank.adminApi.get('/audit?action=client_app.published');
    expect(JSON.stringify(audit.body)).toContain('client_app.published');
  });

  test('a client gets the published app without the identity settings', async () => {
    const app = await bankingApp();
    const client = await appClient(inst.bank, { name: 'App Client' });
    const mine = await Api.as(client).get('/me/app');
    expectStatus(mine, 200);
    expect(mine.body).toMatchObject({ available: true, version: app.version, institution: { name: expect.any(String) } });
    expect(mine.body.definition.pages.home.widgets.length).toBeGreaterThan(3);
    expect(mine.body.definition.identity).toBeUndefined();
  });
});

test.describe('APP-02 Publish, version and roll back; broken apps are not published', { tag: ['@designer', '@APP-02'] }, () => {
  test('validation lists what is broken and publishing is refused; the draft is kept', async () => {
    const app = await bankingApp();
    const draft = structuredClone(app.definition);
    draft.navigation.push({ page: 'nowhere', label: 'Lost' });
    draft.pages.home.widgets.push({ id: 'w-bad-source', type: 'list', props: { title: 'Policies', source: 'records:policies' } });
    draft.pages.home.widgets.push({ id: 'w-bad-rule', type: 'text', visibleIf: "not('customer' in me.segments)", props: { text: 'Hi' } });
    draft.journeys.transfer.donePage = 'missing-page';
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);

    const validation = await designer.post('/client-apps/current/validate');
    expectStatus(validation, 200);
    const errors = validation.body.errors.join('\n');
    expect(errors).toContain('navigation "Lost" opens the unknown page "nowhere"');
    expect(errors).toContain('reads "records:policies", which is not a declared collection');
    expect(errors).toContain('use $not(…)');
    expect(errors).toContain('journey "transfer" ends on the unknown page "missing-page"');

    const publish = await designer.post('/client-apps/current/publish');
    expectStatus(publish, 422);
    expect(publish.body.errors.length).toBeGreaterThanOrEqual(4);
    expect((await designer.get('/client-apps/current')).body.draft.navigation.some((n: any) => n.page === 'nowhere')).toBe(true);
    // Clients still get version 1.
    const client = await appClient(inst.bank);
    expect((await Api.as(client).get('/me/app')).body.version).toBe(app.version);
  });

  test('a journey whose workflow is not published blocks the publication', async () => {
    const app = await bankingApp();
    const draft = structuredClone(app.definition);
    const wf = await designer.post('/workflows', { yaml: minimalWorkflowYaml(`Draft journey ${Date.now()}`) });
    expectStatus(wf, [200, 201]);
    draft.journeys.draft_one = { workflowId: wf.body.id, title: 'Draft one', inputs: [], stages: [] };
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    const validation = await designer.post('/client-apps/current/validate');
    expect(validation.body.errors.join('\n')).toMatch(/journey "draft_one" runs ".*", which is not published/);
  });

  test('a new version goes live at once; an earlier one can be made live again (rollback)', async () => {
    const app = await bankingApp();
    const draft = structuredClone(app.definition);
    draft.name = 'Banking app v2';
    draft.pages.help.title = 'Support';
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    const published = await designer.post('/client-apps/current/publish');
    expectStatus(published, 200);
    expect(published.body.activeVersion).toBe(app.version + 1);
    expect(published.body.versions.map((v: any) => v.version)).toEqual([app.version + 1, app.version]);

    const client = Api.as(await appClient(inst.bank));
    expect((await client.get('/me/app')).body.definition.pages.help.title).toBe('Support');

    const rollback = await designer.post('/client-apps/current/activate', { version: app.version });
    expectStatus(rollback, 200);
    expect(rollback.body.activeVersion).toBe(app.version);
    expect((await client.get('/me/app')).body.definition.pages.help.title).toBe('Help');
    // The draft is untouched by a rollback.
    expect((await designer.get('/client-apps/current')).body.draft.name).toBe('Banking app v2');
    const old = await designer.get(`/client-apps/current/versions/${app.version}`);
    expect(old.body.definition.name).toBe('Banking app');
  });
});

test.describe('APP-10 Who may build, publish and preview the app', { tag: ['@designer', '@APP-10', '@X-02'] }, () => {
  test('reviewers do not see the studio; integration managers and auditors read it but cannot change it', async () => {
    const app = await bankingApp();
    expectForbidden(await Api.as(inst.members.analyst).get('/client-apps/current'));
    for (const member of [inst.members.integrations, inst.members.auditor]) {
      const api = Api.as(member);
      expectStatus(await api.get('/client-apps/current'), 200);
      expectForbidden(await api.put('/client-apps/current/draft', { definition: app.definition }));
      expectForbidden(await api.post('/client-apps/current/publish'));
      expectForbidden(await api.post('/client-apps/current/activate', { version: 1 }));
    }
  });

  test('previewing the app as a real client needs clients:read and is audited', async () => {
    await bankingApp();
    const client = await appClient(inst.bank, { name: 'Preview Me' });
    const forbidden = await designer.post('/client-apps/current/preview', { clientId: client.user.userId, sources: ['me'] });
    expectForbidden(forbidden);
    const admin = inst.bank.adminApi;
    const preview = await admin.post('/client-apps/current/preview', { clientId: client.user.userId, sources: ['me', 'records:accounts', 'journeys'] });
    expectStatus(preview, 200);
    expect(preview.body.me).toMatchObject({ email: client.email, name: 'Preview Me' });
    expect(preview.body.records).toEqual({ accounts: [] });
    const audit = await admin.get('/audit?action=client_app.previewed');
    expect(JSON.stringify(audit.body)).toContain(client.user.userId);
    // Only declared sources, even in the studio.
    expectStatus(await admin.post('/client-apps/current/preview', { clientId: client.user.userId, sources: ['records:secrets'] }), 400);
  });
});
