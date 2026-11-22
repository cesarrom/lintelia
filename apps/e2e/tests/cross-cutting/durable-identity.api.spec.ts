import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { restateQuery } from '../../support/infra';
import { decide, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { starter: 'relationship_manager', analyst: 'reviewer', designer: 'flow_designer' } });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('X-05 Durable workflow identity', { tag: ['@cross-cutting', '@X-05'] }, () => {
  test('no session token is ever written to the workflow journal', async () => {
    const startedAt = new Date(Date.now() - 1000).toISOString();
    const email = uniqueEmail('journal', 'customers.example');
    const created = await Api.as(inst.members.starter).post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(created, 202);
    await waitForTask(Api.as(inst.members.analyst), created.body.caseId);
    // The case engine's journal (caseRun invocations) must never contain a session token.
    const leaks = await restateQuery<{ n: number }>(
      `select count(*) as n from sys_journal j join sys_invocation i on i.id = j.id
       where i.target_service_name = 'caseRun' and j.appended_at > '${startedAt}'
         and (j.entry_json like '%eyJhbGciOi%' or j.entry_json like '%Bearer %')`,
    );
    const runs = await restateQuery<{ n: number }>(
      `select count(*) as n from sys_invocation where target_service_name = 'caseRun' and created_at > '${startedAt}'`,
    );
    expect(Number(runs[0].n)).toBeGreaterThan(0);
    expect(Number(leaks[0].n)).toBe(0);
  });

  test('a case keeps running after the member who started it is deactivated', async () => {
    const email = uniqueEmail('orphan', 'customers.example');
    const created = await Api.as(inst.members.starter).post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(created, 202);
    const starterId = inst.members.starter.user.userId;
    expectStatus(await inst.bank.adminApi.patch(`/users/${starterId}/deactivate`), 200);

    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, created.body.caseId);
    await analyst.post(`/tasks/${task.id}/claim`);
    expectStatus(await decide(analyst, task.id, 'approve'), 200);
    const kase = await waitForCase(inst.bank.adminApi, created.body.caseId, (c) => c.status === 'approved');
    expect(kase.initiatedBy.email).toBe(inst.members.starter.email);
  });
});
