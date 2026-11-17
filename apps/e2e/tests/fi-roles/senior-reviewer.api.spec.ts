import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { decide, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let highRiskFlow: string;
let standardFlow: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { lead1: 'senior_reviewer', lead2: 'senior_reviewer', analyst: 'reviewer', designer: 'flow_designer' } });
  const designer = Api.as(inst.members.designer);
  highRiskFlow = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'high', SLA: 'PT24H' }));
  standardFlow = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const openCase = async (workflowId: string) => {
  const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: uniqueEmail('applicant', 'customers.example') } });
  expectStatus(started, 202);
  return started.body.caseId as string;
};

test.describe('SUP-01 Four-eyes approval of high-risk cases', { tag: ['@senior-reviewer', '@SUP-01'] }, () => {
  test('a second, different approver is required', async () => {
    const caseId = await openCase(highRiskFlow);
    const lead1 = Api.as(inst.members.lead1);
    const lead2 = Api.as(inst.members.lead2);
    const task = await waitForTask(lead1, caseId);

    const first = await decide(lead1, task.id, 'approve', 'First approval');
    expectStatus(first, 200);
    expect(first.body.status).toBe('pending_second_approval');
    expectForbidden(await decide(lead1, task.id, 'approve', 'Approving twice'));

    expectStatus(await decide(lead2, task.id, 'approve', 'Second approval'), 200);
    const kase = await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved');
    expect(kase.decisions.map((d: any) => d.by)).toEqual([inst.members.lead1.email, inst.members.lead2.email]);
  });
});

test.describe('SUP-02 Reassign work', { tag: ['@senior-reviewer', '@SUP-02'] }, () => {
  test('team leads reassign tasks; reviewers cannot', async () => {
    const caseId = await openCase(standardFlow);
    const lead = Api.as(inst.members.lead1);
    const analyst = Api.as(inst.members.analyst);
    // Team leads see every open task (tasks:assign), not only their own queues.
    const task = await waitForTask(lead, caseId, { view: 'all' });
    const analystId = inst.members.analyst.user.userId;

    expectForbidden(await analyst.post(`/tasks/${task.id}/assign`, { assigneeId: analystId }));
    expectStatus(await lead.post(`/tasks/${task.id}/assign`, { assigneeId: analystId }), 200);
    const mine = await analyst.get('/tasks?view=mine');
    expect((mine.body as any[]).map((t) => t.id)).toContain(task.id);
  });
});
