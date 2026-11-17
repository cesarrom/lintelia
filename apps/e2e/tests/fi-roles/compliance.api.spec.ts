import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addClient, deleteTenant, uniqueEmail } from '../../support/factories';
import { decide, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let caseId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { mlro: 'compliance_officer', analyst: 'reviewer', designer: 'flow_designer' } });
  const workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: uniqueEmail('applicant', 'customers.example') } });
  expectStatus(started, 202);
  caseId = started.body.caseId;
  const analyst = Api.as(inst.members.analyst);
  const task = await waitForTask(analyst, caseId);
  await analyst.post(`/tasks/${task.id}/claim`);
  expectStatus(await decide(analyst, task.id, 'approve', 'All good'), 200);
  await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved');
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CMP-02 Case timeline and evidence export', { tag: ['@compliance', '@CMP-02'] }, () => {
  test('the timeline shows who did what, in order', async () => {
    const timeline = await Api.as(inst.members.mlro).get(`/cases/${caseId}/timeline`);
    expectStatus(timeline, 200);
    const actions = (timeline.body as any[]).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['case.created', 'task.created', 'task.claimed', 'task.decided', 'case.approved']));
    const decided = (timeline.body as any[]).find((e) => e.action === 'task.decided');
    expect(decided.actor.email).toBe(inst.members.analyst.email);
  });

  test('compliance exports the evidence pack; reviewers cannot', async () => {
    const exported = await Api.as(inst.members.mlro).get(`/cases/${caseId}/export`);
    expectStatus(exported, 200);
    expect(exported.body).toMatchObject({ case: { id: caseId }, timeline: expect.any(Array) });
    expectForbidden(await Api.as(inst.members.analyst).get(`/cases/${caseId}/export`));
  });
});

test.describe('CMP-03 Handle clients data-rights requests', { tag: ['@compliance', '@CMP-03', '@CLI-10'] }, () => {
  test("a client's export request reaches compliance, who completes it", async () => {
    const client = await addClient(inst.bank);
    const requested = await Api.as(client).post('/me/data-requests', { type: 'export' });
    expectStatus(requested, 202);

    const mlro = Api.as(inst.members.mlro);
    const list = await mlro.get('/data-requests');
    expectStatus(list, 200);
    const request = (list.body as any[]).find((r) => r.id === requested.body.id);
    expect(request).toMatchObject({ type: 'export', status: 'open', client: { email: client.email } });
    expectStatus(await mlro.post(`/data-requests/${request.id}/complete`), 200);
    expectForbidden(await Api.as(inst.members.analyst).get('/data-requests'));
  });
});
