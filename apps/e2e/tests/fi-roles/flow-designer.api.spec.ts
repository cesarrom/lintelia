import { test, expect } from '@playwright/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { applyAsClient, publishForm, waitForCase, waitForTask, type Member } from '../../support/scenario';
import { minimalWorkflowYaml, publishWorkflow, simpleFormConfig, workflowFixture } from '../../support/workflows';

let bank: TenantHandle;
let designer: Member;
let api: Api;
test.beforeAll(async () => {
  bank = await createTenant();
  designer = await addMember(bank, { roles: ['flow_designer'], label: 'designer' });
  api = Api.as(designer);
});
test.afterAll(async () => { await deleteTenant(bank); });

const siteOrigin = () => `https://www.${bank.key}.example`;

test.describe('DES-01 Build, publish and embed a form', { tag: ['@flow-designer', '@DES-01'] }, () => {
  let workflowId: string;
  test.beforeAll(async () => {
    workflowId = await publishWorkflow(api, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  });

  test('a form can only be published onto a published workflow', async () => {
    const form = await api.post('/forms', { name: 'Orphan', config: simpleFormConfig('orphan') });
    expectStatus(await api.post(`/forms/${form.body.id}/publish`, { allowedOrigins: [siteOrigin()] }), 400);
    const draft = await api.post('/workflows', { yaml: minimalWorkflowYaml(`Unpublished ${Date.now()}`) });
    expectStatus(await api.post(`/forms/${form.body.id}/publish`, { workflowId: draft.body.id, allowedOrigins: [siteOrigin()] }), 409);
  });

  test('a published form has a public key and embed snippet; the public view exposes only what renders the form', async () => {
    const form = await api.post('/forms', { name: 'Account application', config: simpleFormConfig('account') });
    expectStatus(form, [200, 201]);
    const published = await api.post(`/forms/${form.body.id}/publish`, { workflowId, allowedOrigins: [siteOrigin()] });
    expectStatus(published, 200);
    expect(published.body.publicKey).toBeTruthy();
    expect(published.body.embed.script).toContain(published.body.publicKey);

    const publicView = await Api.anonymous().withHeaders({ Origin: siteOrigin() }).get(`/public/forms/${published.body.publicKey}`);
    expectStatus(publicView, 200);
    expect(publicView.body.name).toBe('Account application');
    expect(publicView.body).not.toHaveProperty('createdBy');
    expect(publicView.body).not.toHaveProperty('tenantId');
  });

  test('the public form refuses origins that are not allowed, and disappears when unpublished', async () => {
    const form = await api.post('/forms', { name: 'Restricted', config: simpleFormConfig('restricted') });
    const published = await api.post(`/forms/${form.body.id}/publish`, { workflowId, allowedOrigins: [siteOrigin()] });
    // Also when the form is framed: the hosted page reports the embedding site.
    expectStatus(await Api.anonymous().withHeaders({ 'X-Embed-Origin': 'https://evil.example' }).get(`/public/forms/${published.body.publicKey}`), 403);
    expectStatus(await Api.anonymous().withHeaders({ Origin: 'https://evil.example' }).get(`/public/forms/${published.body.publicKey}`), 403);
    expectStatus(await api.post(`/forms/${form.body.id}/unpublish`), 200);
    expectStatus(await Api.anonymous().withHeaders({ Origin: siteOrigin() }).get(`/public/forms/${published.body.publicKey}`), 404);
  });

  test('members without forms:publish cannot publish', async () => {
    const reviewer = await addMember(bank, { roles: ['reviewer'] });
    const form = await api.post('/forms', { name: 'Not yours', config: simpleFormConfig('nope') });
    expectForbidden(await Api.as(reviewer).post(`/forms/${form.body.id}/publish`, { workflowId, allowedOrigins: [siteOrigin()] }));
  });
});

test.describe('DES-02 Build, validate and publish versioned workflows', { tag: ['@flow-designer', '@DES-02'] }, () => {
  test('new workflows are drafts; publishing freezes version 1', async () => {
    const created = await api.post('/workflows', { yaml: minimalWorkflowYaml(`Versioned ${Date.now()}`) });
    expectStatus(created, 201);
    expect(created.body).toMatchObject({ status: 'draft', version: 1 });
    const published = await api.post(`/workflows/${created.body.id}/publish`);
    expectStatus(published, 200);
    expect(published.body).toMatchObject({ status: 'active', version: 1 });
  });

  test('editing a published workflow creates a new draft; the published version keeps serving', async () => {
    const id = await publishWorkflow(api, minimalWorkflowYaml(`Evolving ${Date.now()}`));
    expectStatus(await api.put(`/workflows/${id}`, { yaml: minimalWorkflowYaml('Evolving v2') }), 200);
    const versions = await api.get(`/workflows/${id}/versions`);
    expectStatus(versions, 200);
    expect((versions.body as any[]).map((v) => [v.version, v.status])).toEqual([[1, 'active'], [2, 'draft']]);
  });

  test('definitions with unknown components are refused at publish with errors', async () => {
    const yaml = minimalWorkflowYaml(`Broken ${Date.now()}`).replace('type: end', 'type: teleport');
    const created = await api.post('/workflows', { yaml });
    expectStatus(created, 201);
    const published = await api.post(`/workflows/${created.body.id}/publish`);
    expectStatus(published, 422);
    expect(JSON.stringify(published.body.errors)).toContain('teleport');
  });

  test('executions cannot start from a draft', async () => {
    const created = await api.post('/workflows', { yaml: minimalWorkflowYaml(`Draft only ${Date.now()}`) });
    expectStatus(await bank.adminApi.post(`/workflows/${created.body.id}/executions`, { inputs: {} }), 409);
  });

  test('members without workflows:publish cannot publish', async () => {
    const created = await api.post('/workflows', { yaml: minimalWorkflowYaml(`Guarded ${Date.now()}`) });
    const reviewer = await addMember(bank, { roles: ['reviewer'] });
    expectForbidden(await Api.as(reviewer).post(`/workflows/${created.body.id}/publish`));
  });
});

test.describe('DES-03 Trigger workflows', { tag: ['@flow-designer', '@DES-03'] }, () => {
  test('submitting a published form starts the linked workflow and opens a case', async () => {
    const workflowId = await publishWorkflow(api, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
    const { publicKey } = await publishForm(api, bank, workflowId);
    const { caseId } = await applyAsClient(bank, publicKey);
    const kase = await waitForCase(bank.adminApi, caseId, (c) => c.status === 'in_review');
    expect(kase.workflow).toMatchObject({ id: workflowId, version: 1 });
  });
});

test.describe('DES-04 Route human steps to roles', { tag: ['@flow-designer', '@DES-04'] }, () => {
  test('a review routed to reviewers is visible to reviewers only', async () => {
    const reviewer = await addMember(bank, { roles: ['reviewer'] });
    const rm = await addMember(bank, { roles: ['relationship_manager'] });
    const workflowId = await publishWorkflow(api, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
    const started = await bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: 'routed@customers.example' } });
    expectStatus(started, 202);

    const task = await waitForTask(Api.as(reviewer), started.body.caseId);
    expect(task.queue).toMatchObject({ role: 'reviewer' });
    expectForbidden(await api.get('/tasks?view=queue'));
    const rmTasks = await Api.as(rm).get('/tasks?view=queue');
    expect([403, 200]).toContain(rmTasks.status);
    if (rmTasks.status === 200) expect((rmTasks.body as any[]).some((t) => t.caseId === started.body.caseId)).toBe(false);
  });
});
