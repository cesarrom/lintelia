import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { clientSignIn, prepareInstitution, waitForCase, type Institution } from '../../support/scenario';
import { publishWorkflow, simpleFormConfig } from '../../support/workflows';

/** CLI-05 (forms): a workflow sends one of the institution's forms to the client; the answers feed the next steps. */
let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  const designer = Api.as(inst.members.designer);
  const form = await designer.post('/forms', { name: `Employment details ${Date.now()}`, config: simpleFormConfig('employment') });
  expectStatus(form, [200, 201]);
  workflowId = await publishWorkflow(designer, `schemaVersion: "1"
name: Form request ${Date.now()}
description: sends a form to the applicant
version: 1
triggers: []
inputs:
  - { id: email, name: email, type: string, required: true }
steps:
  - id: start
    name: Start
    type: start
    events:
      - { name: finished, outputs: [], next: [details] }
  - id: details
    name: Employment details
    type: form.request
    config: { formId: ${form.body.id}, title: Tell us about your employment }
    events:
      - { name: submitted, outputs: [], next: [title] }
      - { name: expired, outputs: [], next: [title] }
  - id: title
    name: Title
    type: case.update
    config: { title: "Application of {{steps.details.answers.fullName}}" }
    events:
      - { name: done, outputs: [], next: [end] }
  - id: end
    name: Done
    type: case.decision
    config: { status: completed }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
`);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CLI-05 Fill a form the institution sends', { tag: ['@client', '@CLI-05'] }, () => {
  test('the client fills the form in the portal; its answers are used by the workflow', async () => {
    const email = uniqueEmail('form-request', 'customers.example');
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(started, 202);
    await waitForCase(inst.bank.adminApi, started.body.caseId, (c) => c.status === 'pending_client' || c.status === 'in_progress');
    const me = Api.as(await clientSignIn(inst.bank, email));
    let request: any;
    await expect.poll(async () => {
      request = ((await me.get('/me/requests')).body as any[]).find((r) => r.status === 'open');
      return request?.title;
    }, { timeout: 15_000 }).toBe('Tell us about your employment');
    const form = await me.get(`/me/requests/${request.id}/form`);
    expectStatus(form, 200);
    expect(form.body.config.components.map((c: any) => c.id)).toEqual(['fullName', 'email']);
    expectStatus(await me.post(`/me/requests/${request.id}/respond`, { response: { form: { fullName: 'Frida Form', email } } }), 200);
    const kase = await waitForCase(inst.bank.adminApi, started.body.caseId, (c) => c.status === 'completed');
    expect(kase.title).toBe('Application of Frida Form');
  });

  test('nobody else can read the form request', async () => {
    const other = Api.as(await clientSignIn(inst.bank, uniqueEmail('nosy', 'customers.example')));
    const email = uniqueEmail('form-owner', 'customers.example');
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    const owner = Api.as(await clientSignIn(inst.bank, email));
    let requestId = '';
    await expect.poll(async () => { requestId = ((await owner.get('/me/requests')).body as any[])[0]?.id ?? ''; return requestId; }, { timeout: 15_000 }).not.toBe('');
    expectStatus(await other.get(`/me/requests/${requestId}/form`), 404);
    expect(started.status).toBe(202);
  });
});
