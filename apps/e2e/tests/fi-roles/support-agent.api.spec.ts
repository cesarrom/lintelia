import { test, expect } from '@playwright/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { waitForEmail } from '../../support/mailbox';
import { decide, prepareInstitution, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { agent: 'support_agent', designer: 'flow_designer', lead: 'senior_reviewer' } });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe("AGT-01 Look up a client's application and resend their link", { tag: ['@support-agent', '@AGT-01'] }, () => {
  test('agents see status, resend links and cannot decide', async () => {
    const workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
    const email = uniqueEmail('caller', 'customers.example');
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(started, 202);
    const agent = Api.as(inst.members.agent);

    const kase = await agent.get(`/cases/${started.body.caseId}`);
    expectStatus(kase, 200);
    expect(kase.body.status).toBeTruthy();

    const since = Date.now() - 1000;
    expectStatus(await agent.post(`/cases/${started.body.caseId}/resend-link`), 202);
    await waitForEmail({ tenant: inst.bank.key, to: email, since });

    const task = await waitForTask(Api.as(inst.members.lead), started.body.caseId, { view: 'all' });
    expectForbidden(await decide(agent, task.id, 'approve'));
  });
});
