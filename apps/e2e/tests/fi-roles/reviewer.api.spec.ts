import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { decide, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

let inst: Institution;
let standardFlow: string;
let highRiskFlow: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { alice: 'reviewer', bob: 'reviewer', designer: 'flow_designer' } });
  const designer = Api.as(inst.members.designer);
  standardFlow = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT24H' }));
  highRiskFlow = await publishWorkflow(designer, workflowFixture('manual-review', { AUTHORITY: 'high', SLA: 'PT24H' }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const openCase = async (workflowId: string) => {
  const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: uniqueEmail('applicant', 'customers.example') } });
  expectStatus(started, 202);
  return started.body.caseId as string;
};

test.describe('REV-01 Work my queue', { tag: ['@reviewer', '@REV-01'] }, () => {
  test('tasks routed to my role appear in my queue; claiming assigns them to me only', async () => {
    const caseId = await openCase(standardFlow);
    const alice = Api.as(inst.members.alice);
    const bob = Api.as(inst.members.bob);
    const task = await waitForTask(alice, caseId);
    expect(task.status).toBe('open');

    expectStatus(await alice.post(`/tasks/${task.id}/claim`), 200);
    const mine = await alice.get('/tasks?view=mine');
    expect((mine.body as any[]).map((t) => t.id)).toContain(task.id);
    const bobsMine = await bob.get('/tasks?view=mine');
    expect((bobsMine.body as any[]).map((t) => t.id)).not.toContain(task.id);
    expectStatus(await bob.post(`/tasks/${task.id}/claim`), 409);
  });
});

test.describe('REV-02 Decide a case within my authority', { tag: ['@reviewer', '@REV-02'] }, () => {
  test('rejecting requires a reason; approving completes the case', async () => {
    const caseId = await openCase(standardFlow);
    const alice = Api.as(inst.members.alice);
    const task = await waitForTask(alice, caseId);
    await alice.post(`/tasks/${task.id}/claim`);
    expectStatus(await alice.post(`/tasks/${task.id}/decision`, { decision: 'reject' }), 400);
    expectStatus(await decide(alice, task.id, 'approve', 'Documents consistent'), 200);
    const kase = await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved');
    expect(kase.decisions?.[0]).toMatchObject({ decision: 'approve', by: inst.members.alice.email });
  });

  test('a reviewer cannot take high-authority decisions', async () => {
    const caseId = await openCase(highRiskFlow);
    const alice = Api.as(inst.members.alice);
    const task = await waitForTask(alice, caseId);
    expect(task.authority).toBe('high');
    await alice.post(`/tasks/${task.id}/claim`);
    expectForbidden(await decide(alice, task.id, 'approve'));
  });
});

test.describe('REV-04 Segregation of duties', { tag: ['@reviewer', '@REV-04'] }, () => {
  test('the member who started a case cannot decide its tasks', async () => {
    const caseId = await openCase(standardFlow);
    const admin = inst.bank.adminApi;
    const task = await waitForTask(admin, caseId, { view: 'all' });
    expectForbidden(await decide(admin, task.id, 'approve', 'approving my own case'));
  });
});
