import { test, expect } from '@playwright/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { confirmAssisted, decide, expectCaseStatus, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

/** SCN-04: personal loan with a credit check against the institution's own database and four-eyes above 50,000. */
let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({
    members: { designer: 'flow_designer', rm: 'relationship_manager', analyst: 'reviewer', lead1: 'senior_reviewer', lead2: 'senior_reviewer' },
    connections: ['coreBankingDb'],
  });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('loan-origination', { CORE_BANKING_DB: inst.connections.coreBankingDb }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const apply = async (customerId: string, amount: number) => {
  const email = uniqueEmail('borrower', 'customers.example');
  const created = await Api.as(inst.members.rm).post('/cases', { workflowId, client: { email, name: 'Borrower' }, inputs: { email, customerId, amount } });
  expectStatus(created, 201);
  // Assisted application: the workflow starts once the client confirms it.
  await confirmAssisted(inst.bank, email, created.body.id);
  return created.body.id as string;
};

test.describe('SCN-04 Loan origination', { tag: ['@scenario', '@SCN-04', '@INT-03', '@SUP-01'] }, () => {
  test('a low credit score is declined automatically', async () => {
    const caseId = await apply('C-1003', 5_000);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status), 30_000), 'rejected');
  });

  test('a small loan for a good score needs one reviewer', async () => {
    const caseId = await apply('C-1001', 10_000);
    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, caseId, { timeoutMs: 30_000 });
    expect(task.authority).toBe('standard');
    const kase = await analyst.get(`/cases/${caseId}`);
    expect(kase.body.calculations.find((c: any) => c.step === 'credit')?.values.rows).toEqual([{ score: 780, bureau: 'fake-bureau' }]);
    await analyst.post(`/tasks/${task.id}/claim`);
    expectStatus(await decide(analyst, task.id, 'approve', 'Within policy'), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status)), 'approved');
  });

  test('a large loan needs two different senior approvers', async () => {
    const caseId = await apply('C-1002', 120_000);
    const lead1 = Api.as(inst.members.lead1);
    const task = await waitForTask(lead1, caseId, { timeoutMs: 30_000 });
    expect(task.authority).toBe('high');
    expectForbidden(await decide(Api.as(inst.members.analyst), task.id, 'approve'));
    expect((await decide(lead1, task.id, 'approve', 'Collateral verified')).body.status).toBe('pending_second_approval');
    expectStatus(await decide(Api.as(inst.members.lead2), task.id, 'approve', 'Agree'), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status)), 'approved');
  });
});
