import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { controlFake } from '../../support/fakes';
import { confirmAssisted, decide, expectCaseStatus, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';

/** SCN-05 / CMP-01: sanctions/PEP screening hits are adjudicated by compliance. */
let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({
    members: { designer: 'flow_designer', rm: 'relationship_manager', analyst: 'reviewer', mlro: 'compliance_officer' },
    connections: ['screening'],
  });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), workflowFixture('aml-screening', { SCREENING: inst.connections.screening }));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const apply = async (fullName: string) => {
  const email = uniqueEmail('screened', 'customers.example');
  const created = await Api.as(inst.members.rm).post('/cases', { workflowId, client: { email, name: fullName }, inputs: { email, fullName } });
  expectStatus(created, 201);
  // Assisted application: processing starts once the client confirms it.
  await confirmAssisted(inst.bank, email, created.body.id);
  return created.body.id as string;
};

test.describe('SCN-05 AML screening hit', { tag: ['@scenario', '@SCN-05', '@CMP-01'] }, () => {
  test('a clear result is approved without review', async () => {
    await controlFake('screening', '/results', { name: 'Clear Customer', result: 'clear' });
    expectCaseStatus(await waitForCase(inst.bank.adminApi, await apply('Clear Customer'), (c) => ['approved', 'rejected'].includes(c.status), 30_000), 'approved');
  });

  test('a false positive is cleared by compliance with a documented rationale', async () => {
    await controlFake('screening', '/results', { name: 'John Smith', result: 'potential_match', matches: [{ list: 'sanctions', name: 'John Smyth', score: 0.86 }] });
    const caseId = await apply('John Smith');
    const mlro = Api.as(inst.members.mlro);
    const task = await waitForTask(mlro, caseId, { timeoutMs: 30_000 });
    expect(task.kind).toBe('screening_hit');
    expect((await waitForTask(Api.as(inst.members.analyst), caseId, { timeoutMs: 1_000 }).catch(() => null))).toBeNull();
    // Reviewers cannot decide it (the task is not even visible to them).
    expectStatus(await decide(Api.as(inst.members.analyst), task.id, 'approve'), [403, 404]);
    expectStatus(await decide(mlro, task.id, 'approve', 'Different date of birth and nationality: false positive'), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status)), 'approved');
  });

  test('a true positive is rejected and flagged for suspicious activity reporting', async () => {
    await controlFake('screening', '/results', { name: 'Sanctioned Person', result: 'potential_match', matches: [{ list: 'sanctions', name: 'Sanctioned Person', score: 0.99 }] });
    const caseId = await apply('Sanctioned Person');
    const mlro = Api.as(inst.members.mlro);
    const task = await waitForTask(mlro, caseId, { timeoutMs: 30_000 });
    expectStatus(await decide(mlro, task.id, 'reject', 'Confirmed match on consolidated sanctions list'), 200);
    const kase = await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status));
    expectCaseStatus(kase, 'rejected');
    expect(kase.flags).toContain('suspicious_activity_report');
  });
});
