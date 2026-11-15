import { test, expect } from '@playwright/test';
import { Api, expectStatus, type Session } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { controlFake, requireFake } from '../../support/fakes';
import { withOwnerDb } from '../../support/infra';
import { clientSignIn, prepareInstitution, waitForCase, type Institution } from '../../support/scenario';
import { EICAR, pdfBytes, uploadForRequest } from '../../support/uploads';
import { publishWorkflow } from '../../support/workflows';

/**
 * UPL-*: files clients send are authorised per request item, land in quarantine, and only reach the case after the
 * intake pipeline (type sniffing → malware scan → sanitisation → rescan) (docs/plans/07).
 */
let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  await requireFake('scanner');
  await requireFake('sanitizer');
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), `schemaVersion: "1"
name: Proof of address ${Date.now()}
description: asks the client for a document
version: 1
triggers: []
inputs:
  - { id: email, name: email, type: string, required: true }
steps:
  - id: start
    name: Start
    type: start
    events:
      - { name: finished, outputs: [], next: [ask] }
  - id: ask
    name: Ask for proof of address
    type: client.request
    config:
      title: Please send a proof of address
      items:
        - { key: proofOfAddress, label: Proof of address, type: file }
      expiresAfter: P7D
    events:
      - { name: completed, outputs: [], next: [done] }
      - { name: expired, outputs: [], next: [done] }
  - id: done
    name: Done
    type: case.decision
    config: { status: completed }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
`);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

/** A case waiting for the client's document; returns the client session and the open request. */
async function openRequest() {
  const email = uniqueEmail('uploader', 'customers.example');
  const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
  expectStatus(started, 202);
  await waitForCase(inst.bank.adminApi, started.body.caseId, (c) => c.status === 'pending_client');
  const client: Session = await clientSignIn(inst.bank, email);
  const me = Api.as(client);
  const request = (await me.get(`/me/cases/${started.body.caseId}`)).body.requests.find((r: any) => r.status === 'open');
  return { caseId: started.body.caseId as string, me, client, taskId: request.id as string };
}

test.describe('UPL-01 A client uploads a requested document; the reviewer gets it', { tag: ['@client', '@UPL-01', '@CLI-05'] }, () => {
  test('a PDF goes through intake, answers the request and is downloadable by the team through a short-lived link', async () => {
    const { caseId, me, taskId } = await openRequest();
    const { outcome } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'utility-bill.pdf', type: 'application/pdf', bytes: await pdfBytes() });
    expect(outcome).toMatchObject({ status: 'available' });
    expectStatus(await me.post(`/me/cases/${caseId}/requests/${taskId}/respond`, { response: { proofOfAddress: [outcome!.fileId] } }), 200);
    const kase = await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'completed');
    expect(kase.files).toEqual([expect.objectContaining({ id: outcome!.fileId, name: 'utility-bill.pdf', contentType: 'application/pdf', source: 'client', scan: 'clean' })]);

    const link = await inst.bank.adminApi.post(`/case-files/${outcome!.fileId}/download-url`);
    expectStatus(link, 200);
    const download = await fetch(link.body.url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await download.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    const timeline = await inst.bank.adminApi.get(`/cases/${caseId}/timeline`);
    expect((timeline.body as any[]).map((e) => e.action)).toEqual(expect.arrayContaining(['file.uploaded', 'file.accepted', 'file.downloaded']));
  });

  test('a request cannot be answered with a file that is not ready or belongs to someone else', async () => {
    const first = await openRequest();
    const { outcome } = await uploadForRequest(first.me, { taskId: first.taskId, itemKey: 'proofOfAddress', name: 'mine.pdf', type: 'application/pdf', bytes: await pdfBytes() });
    const second = await openRequest();
    expectStatus(await second.me.post(`/me/cases/${second.caseId}/requests/${second.taskId}/respond`, { response: { proofOfAddress: [outcome!.fileId] } }), 400);
    // Nor can another client fetch it.
    expectStatus(await second.me.post(`/case-files/${outcome!.fileId}/download-url`), 404);
  });
});

test.describe('UPL-02 Malware is refused', { tag: ['@client', '@UPL-02', '@X-04'] }, () => {
  test('an infected file is rejected, never reaches the case, and the rejection is audited', async () => {
    const { caseId, me, taskId } = await openRequest();
    const { outcome } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'invoice.pdf', type: 'application/pdf', bytes: await pdfBytes('Invoice', { trailer: EICAR }) });
    expect(outcome).toMatchObject({ status: 'rejected', rejectionReason: 'malware detected', fileId: null });
    expect((await inst.bank.adminApi.get(`/cases/${caseId}`)).body.files).toEqual([]);
    const timeline = await inst.bank.adminApi.get(`/cases/${caseId}/timeline`);
    const rejected = (timeline.body as any[]).find((e) => e.action === 'file.rejected');
    expect(rejected.details).toMatchObject({ reason: 'malware detected', scan: { result: 'infected', signature: 'Eicar-Signature' } });
  });
});

test.describe('UPL-03 Wrong types and sizes are refused', { tag: ['@client', '@UPL-03'] }, () => {
  test('declared types and sizes are checked at intent', async () => {
    const { me, taskId } = await openRequest();
    expectStatus(await me.post('/uploads', { purpose: 'client_request_item', taskId, itemKey: 'proofOfAddress', name: 'tool.exe', type: 'application/x-msdownload', size: 1000 }), 400);
    expectStatus(await me.post('/uploads', { purpose: 'client_request_item', taskId, itemKey: 'proofOfAddress', name: 'huge.pdf', type: 'application/pdf', size: 25 * 1024 * 1024 }), 400);
    expectStatus(await me.post('/uploads', { purpose: 'client_request_item', taskId, itemKey: 'notAnItem', name: 'x.pdf', type: 'application/pdf', size: 1000 }), 400);
  });

  test('an executable renamed to .pdf is refused after upload (type sniffed from the bytes)', async () => {
    const { me, taskId } = await openRequest();
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(62), Buffer.from('PE\0\0'), Buffer.alloc(200)]);
    const { outcome } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'bill.pdf', type: 'application/pdf', bytes: exe });
    expect(outcome?.status).toBe('rejected');
    expect(outcome?.rejectionReason).toMatch(/not accepted/);
  });

  test('more bytes than announced are cut off', async () => {
    const { me, taskId } = await openRequest();
    const bytes = await pdfBytes();
    const { putStatus } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'bill.pdf', type: 'application/pdf', bytes, declaredSize: 100 });
    expect(putStatus).toBe(413);
  });

  test('only the client a request is addressed to can upload for it', async () => {
    const { taskId } = await openRequest();
    const other = await openRequest();
    expectStatus(await other.me.post('/uploads', { purpose: 'client_request_item', taskId, itemKey: 'proofOfAddress', name: 'x.pdf', type: 'application/pdf', size: 1000 }), 404);
    expectStatus(await inst.bank.adminApi.post('/uploads', { purpose: 'client_request_item', taskId, itemKey: 'proofOfAddress', name: 'x.pdf', type: 'application/pdf', size: 1000 }), 403);
  });
});

test.describe('UPL-04 Files are sanitised before use', { tag: ['@client', '@UPL-04'] }, () => {
  test('a PDF with JavaScript is accepted without it, and the reviewer sees what was removed', async () => {
    const { caseId, me, taskId } = await openRequest();
    const { outcome } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'statement.pdf', type: 'application/pdf', bytes: await pdfBytes('Statement', { javascript: true }) });
    expect(outcome?.status).toBe('available');
    expect(outcome?.sanitization).toEqual(expect.arrayContaining(['removed JavaScript']));
    const link = await inst.bank.adminApi.post(`/case-files/${outcome!.fileId}/download-url`);
    const stored = Buffer.from(await (await fetch(link.body.url)).arrayBuffer()).toString('latin1');
    expect(stored).not.toContain('/JavaScript');
    expect(stored).not.toContain('app.alert');
    const kase = await inst.bank.adminApi.get(`/cases/${caseId}`);
    expect(kase.body.files[0].sanitization).toEqual(expect.arrayContaining(['removed JavaScript']));
  });

  test('when the sanitiser is down the file is kept out of the case (never used unsanitised)', async () => {
    const { caseId, me, taskId } = await openRequest();
    await controlFake('sanitizer', '/fail-next', { count: 10 });
    try {
      const { outcome } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'payslip.pdf', type: 'application/pdf', bytes: await pdfBytes('Payslip') });
      expect(outcome).toMatchObject({ status: 'rejected', rejectionReason: 'processing_failed' });
      expect((await inst.bank.adminApi.get(`/cases/${caseId}`)).body.files).toEqual([]);
    } finally {
      await controlFake('sanitizer', '/fail-next', { count: 0 });
    }
  });

  test('quarantine never keeps the bytes of rejected files', async () => {
    const { me, taskId } = await openRequest();
    const { outcome } = await uploadForRequest(me, { taskId, itemKey: 'proofOfAddress', name: 'virus.pdf', type: 'application/pdf', bytes: await pdfBytes('x', { trailer: EICAR }) });
    expect(outcome?.status).toBe('rejected');
    const [row] = await withOwnerDb((sql) => sql`select count(*)::int as n from case_files where upload_id = ${outcome!.id}`);
    expect(row.n).toBe(0);
  });
});
