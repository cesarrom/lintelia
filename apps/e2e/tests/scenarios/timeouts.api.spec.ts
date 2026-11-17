import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { controlFake } from '../../support/fakes';
import { waitForEmail } from '../../support/mailbox';
import { applyAsClient, expectCaseStatus, prepareInstitution, publishForm, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

/** SCN-07: abandoned applications are reminded then expired; reviews that breach their SLA are escalated. */
let inst: Institution;

test.beforeAll(async () => {
  inst = await prepareInstitution({
    members: { designer: 'flow_designer', analyst: 'reviewer', lead: 'senior_reviewer' },
    connections: ['didit', 'documenso'],
  });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('SCN-07 Timeouts', { tag: ['@scenario', '@SCN-07', '@DES-04', '@SUP-02'] }, () => {
  test('an applicant who never verifies their identity is reminded, then the case expires', async () => {
    const designer = Api.as(inst.members.designer);
    const workflowId = await publishWorkflow(designer, workflowFixture('retail-account-opening', {
      DIDIT: inst.connections.didit, DOCUMENSO: inst.connections.documenso, REMIND_AFTER: 'PT2S', EXPIRES_AFTER: 'PT6S',
    }));
    const { publicKey } = await publishForm(designer, inst.bank, workflowId);
    const email = uniqueEmail('abandoned', 'customers.example');
    await controlFake('didit', '/decisions', { email, decision: 'Abandoned' });
    const since = Date.now() - 1000;
    const { caseId } = await applyAsClient(inst.bank, publicKey, { email });

    await waitForEmail({ tenant: inst.bank.key, to: email, subject: /reminder|still waiting|complete/i, since, timeoutMs: 15_000 });
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'expired', 20_000), 'expired');
  });

  test('a review that breaches its SLA is escalated to the senior reviewers', async () => {
    const workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('manual-review', { AUTHORITY: 'standard', SLA: 'PT3S' }));
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: uniqueEmail('slow', 'customers.example') } });
    expectStatus(started, 202);
    await waitForTask(Api.as(inst.members.analyst), started.body.caseId);
    const escalated = await waitForTask(Api.as(inst.members.lead), started.body.caseId, { status: 'escalated', timeoutMs: 15_000 });
    expect(escalated.queue).toMatchObject({ role: 'senior_reviewer' });
  });
});
