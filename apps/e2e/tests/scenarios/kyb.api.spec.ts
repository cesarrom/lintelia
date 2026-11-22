import { test, expect } from '../../support/test';
import { Api, expectStatus, type Session } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { controlFake } from '../../support/fakes';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { applyAsClient, decide, expectCaseStatus, prepareInstitution, publishForm, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

/** SCN-09 / CLI-08: a company applies; two UBOs each verify themselves before the business is reviewed. */
let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' }, connections: ['didit'] });
  const designer = Api.as(inst.members.designer);
  // The per-party sub-workflow first, then the business onboarding that runs it for every party.
  const partyWorkflow = await publishWorkflow(designer, workflowFixture('party-verification', { DIDIT: inst.connections.didit }));
  const workflowId = await publishWorkflow(designer, workflowFixture('kyb', { PARTY_WORKFLOW: partyWorkflow }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('SCN-09 Business onboarding with two UBOs', { tag: ['@scenario', '@SCN-09', '@CLI-08'] }, () => {
  test('the review starts only after every UBO has verified their identity', async () => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { companyName: 'Acme Widgets Ltd' });
    const ubos = [uniqueEmail('ubo-a', 'acme-widgets.example'), uniqueEmail('ubo-b', 'acme-widgets.example')];
    const since = Date.now() - 1000;
    for (const email of ubos) {
      await controlFake('didit', '/decisions', { email, decision: 'Approved' });
      expectStatus(await Api.as(client).post(`/me/cases/${caseId}/parties`, { role: 'ubo', email, name: email.split('@')[0] }), 201);
    }
    expectStatus(await Api.as(client).post(`/me/cases/${caseId}/parties/complete`), 200);

    // First UBO verifies; the case is still waiting for the second.
    const joinAs = async (email: string) => {
      const { value: token } = linkWithParam(await waitForEmail({ tenant: inst.bank.key, to: email, since }), 'party');
      const joined = await Api.anonymous(inst.bank.key).post<Session>('/auth/party-invitations/accept', { token });
      expectStatus(joined, 200);
      return Api.as(joined.body);
    };
    await joinAs(ubos[0]);
    await expect.poll(async () => (await inst.bank.adminApi.get(`/cases/${caseId}`)).body?.parties?.find((p: any) => p.email === ubos[0])?.verification, { timeout: 20_000 }).toBe('approved');
    const analyst = Api.as(inst.members.analyst);
    expect(await waitForTask(analyst, caseId, { timeoutMs: 2_000 }).catch(() => null)).toBeNull();

    await joinAs(ubos[1]);
    const task = await waitForTask(analyst, caseId, { timeoutMs: 30_000 });
    await analyst.post(`/tasks/${task.id}/claim`);
    expectStatus(await decide(analyst, task.id, 'approve', 'Ownership structure verified'), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status)), 'approved');
  });
});
