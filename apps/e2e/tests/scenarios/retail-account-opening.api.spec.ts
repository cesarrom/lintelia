import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { controlFake } from '../../support/fakes';
import { waitForEmail } from '../../support/mailbox';
import { applyAsClient, decide, expectCaseStatus, prepareInstitution, publishForm, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';
import { pdfBytes, uploadForRequest } from '../../support/uploads';

/**
 * Retail current account opening (fixtures/workflows/retail-account-opening.yaml): identity verification through the
 * Didit fake, manual review when inconclusive, agreement signature through the Documenso fake.
 */
let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({
    members: { designer: 'flow_designer', analyst: 'reviewer', mlro: 'compliance_officer' },
    connections: ['didit', 'documenso'],
  });
  const designer = Api.as(inst.members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('retail-account-opening', {
    DIDIT: inst.connections.didit, DOCUMENSO: inst.connections.documenso, REMIND_AFTER: 'P3D', EXPIRES_AFTER: 'P30D',
  }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const prepareOutcomes = async (email: string, kyc: 'Approved' | 'Declined' | 'In Review', signature: 'signed' | 'declined' = 'signed') => {
  await controlFake('didit', '/decisions', { email, decision: kyc });
  await controlFake('documenso', '/signatures', { email, outcome: signature });
};

test.describe('SCN-01 Retail account opening: verified, signed, approved', { tag: ['@scenario', '@SCN-01', '@CLI-04', '@CLI-06'] }, () => {
  test('the application is approved without human intervention', async () => {
    const email = uniqueEmail('happy', 'customers.example');
    await prepareOutcomes(email, 'Approved');
    const since = Date.now() - 1000;
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { email });

    const kase = await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status), 30_000);
    expectCaseStatus(kase, 'approved');
    // Results written by the connectors: the identity verification and the signature request…
    expect(kase.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'verification', connectorId: 'didit', status: 'approved' }),
      expect.objectContaining({ type: 'signature_request', connectorId: 'documenso', status: 'signed' }),
    ]));
    // …and the signed agreement, scanned and attached to the case.
    const withFiles = await waitForCase(inst.bank.adminApi, caseId, (c) => c.files?.some((f: any) => f.kind === 'signed_agreement'), 20_000);
    expect(withFiles.files.find((f: any) => f.kind === 'signed_agreement')).toMatchObject({ contentType: 'application/pdf', source: 'connector', scan: 'clean' });
    expect((await Api.as(client).get(`/me/cases/${caseId}`)).body.status).toBe('approved');
    await waitForEmail({ tenant: inst.bank.key, to: email, subject: /approved|welcome/i, since });
  });
});

test.describe('SCN-02 Identity verification declined', { tag: ['@scenario', '@SCN-02', '@CLI-04'] }, () => {
  test('the case is rejected and the applicant is told, without details of the checks', async () => {
    const email = uniqueEmail('declined', 'customers.example');
    await prepareOutcomes(email, 'Declined');
    const since = Date.now() - 1000;
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { email });
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected', 'expired'].includes(c.status), 30_000), 'rejected');
    const mine = await Api.as(client).get(`/me/cases/${caseId}`);
    expect(mine.body.status).toBe('rejected');
    expect(JSON.stringify(mine.body)).not.toMatch(/didit|liveness|score/i);
    await waitForEmail({ tenant: inst.bank.key, to: email, subject: /application/i, since });
  });
});

test.describe('SCN-03 Inconclusive verification goes to manual review', { tag: ['@scenario', '@SCN-03', '@REV-02'] }, () => {
  test('a reviewer sees the verification result and approves; the client then signs', async () => {
    const email = uniqueEmail('manual', 'customers.example');
    await prepareOutcomes(email, 'In Review');
    const { caseId } = await applyAsClient(inst.bank, publicKey, { email });
    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, caseId, { timeoutMs: 30_000 });
    const kase = await analyst.get(`/cases/${caseId}`);
    expect(kase.body.records.find((r: any) => r.type === 'verification')).toMatchObject({ status: 'in_review', data: { warnings: ['Document photo is blurry'] } });
    await analyst.post(`/tasks/${task.id}/claim`);
    expectStatus(await decide(analyst, task.id, 'approve', 'Document photo blurry but data matches bureau'), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status), 30_000), 'approved');
  });
});

test.describe('SCN-06 Document resubmission', { tag: ['@scenario', '@SCN-06', '@REV-03', '@CLI-05'] }, () => {
  test('the reviewer asks for a new proof of address; the client uploads it; the review resumes', async () => {
    const email = uniqueEmail('resubmit', 'customers.example');
    await prepareOutcomes(email, 'In Review');
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { email });
    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, caseId, { timeoutMs: 30_000 });
    await analyst.post(`/tasks/${task.id}/claim`);
    const since = Date.now() - 1000;
    expectStatus(await decide(analyst, task.id, 'request_info', 'Proof of address older than 3 months', {
      items: [{ key: 'proofOfAddress', label: 'Proof of address (less than 3 months old)', type: 'file' }],
    }), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'pending_client'), 'pending_client');
    await waitForEmail({ tenant: inst.bank.key, to: email, subject: /information|document|action needed/i, since });

    const me = Api.as(client);
    const request = (await me.get(`/me/cases/${caseId}`)).body.requests.find((r: any) => r.status === 'open');
    const { outcome } = await uploadForRequest(me, { taskId: request.id, itemKey: 'proofOfAddress', name: 'utility-bill.pdf', type: 'application/pdf', bytes: await pdfBytes('Utility bill, March') });
    expect(outcome?.status).toBe('available');
    expectStatus(await me.post(`/me/cases/${caseId}/requests/${request.id}/respond`, { response: { proofOfAddress: [outcome!.fileId] } }), 200);

    // The review goes back to the reviewer who asked.
    const reopened = await waitForTask(analyst, caseId, { view: 'mine', status: 'claimed' });
    expect(reopened.id).toBe(task.id);
    expectStatus(await decide(analyst, task.id, 'approve', 'New proof of address accepted'), 200);
    expectCaseStatus(await waitForCase(inst.bank.adminApi, caseId, (c) => ['approved', 'rejected'].includes(c.status), 30_000), 'approved');
  });
});

test.describe('SCN-08 Audit trail of a complete case', { tag: ['@scenario', '@SCN-08', '@CMP-02', '@X-04'] }, () => {
  test('every step of the case is on record and compliance can export it', async () => {
    const email = uniqueEmail('audited', 'customers.example');
    await prepareOutcomes(email, 'In Review');
    const { caseId } = await applyAsClient(inst.bank, publicKey, { email });
    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, caseId, { timeoutMs: 30_000 });
    await analyst.post(`/tasks/${task.id}/claim`);
    await decide(analyst, task.id, 'approve', 'OK');
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved', 30_000);

    const exported = await Api.as(inst.members.mlro).get(`/cases/${caseId}/export`);
    expectStatus(exported, 200);
    const actions = (exported.body.timeline as any[]).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining([
      'case.submitted', 'record.verification.created', 'record.verification.updated', 'connector.step_completed', 'task.created',
      'task.claimed', 'task.decided', 'record.signature_request.created', 'record.signature_request.updated', 'case.approved',
    ]));
    for (const entry of exported.body.timeline) expect(entry).toMatchObject({ at: expect.any(String), actor: expect.any(Object) });
  });
});
