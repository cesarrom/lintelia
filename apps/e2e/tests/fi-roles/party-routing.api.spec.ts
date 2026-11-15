import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { applyAsClient, decide, prepareInstitution, publishForm, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

/** PTY-01: with `sameAssigneeAs: siblings`, whoever takes the first party's task gets the other parties' tasks too. */
let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', alice: 'reviewer', bob: 'reviewer' } });
  const designer = Api.as(inst.members.designer);
  const check = await publishWorkflow(designer, workflowFixture('party-check'));
  const workflowId = await publishWorkflow(designer, workflowFixture('co-applicants', { PARTY_CHECK: check }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('PTY-01 One team member handles every party', { tag: ['@reviewer', '@PTY-01', '@CLI-09'] }, () => {
  test('claiming the first party task assigns the other parties of the application to the same person', async () => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey);
    const me = Api.as(client);
    expectStatus(await me.post(`/me/cases/${caseId}/parties/complete`), 409);
    expectStatus(await me.post(`/me/cases/${caseId}/parties`, { role: 'co_applicant', email: uniqueEmail('co-a', 'customers.example'), name: 'Co A' }), 201);
    // The minimum is checked when the applicant says the list is complete.
    await expect.poll(async () => (await me.post(`/me/cases/${caseId}/parties/complete`)).status, { timeout: 10_000 }).toBe(400);
    expectStatus(await me.post(`/me/cases/${caseId}/parties`, { role: 'co_applicant', email: uniqueEmail('co-b', 'customers.example'), name: 'Co B' }), 201);
    expectStatus(await me.post(`/me/cases/${caseId}/parties/complete`), 200);

    const alice = Api.as(inst.members.alice);
    const bob = Api.as(inst.members.bob);
    const kase = await waitForCase(inst.bank.adminApi, caseId, (c) => c.parties?.every((p: any) => p.childCaseId));
    const [first, second] = kase.parties.map((p: any) => p.childCaseId as string);
    const firstTask = await waitForTask(alice, first);
    await waitForTask(alice, second);
    expectStatus(await alice.post(`/tasks/${firstTask.id}/claim`), 200);

    const secondTask = await waitForTask(alice, second, { view: 'mine' });
    expect(secondTask.status).toBe('claimed');
    expect((await bob.get('/tasks?view=queue')).body.map((t: any) => t.caseId)).not.toContain(second);

    expectStatus(await decide(alice, firstTask.id, 'done' as never, 'Spoke to them'), 200);
    expectStatus(await decide(alice, secondTask.id, 'done' as never, 'Spoke to them'), 200);
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'completed', 30_000);
  });
});
