import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { clientSignIn, prepareInstitution, waitForCase, type Institution } from '../../support/scenario';
import { EICAR, pdfBytes } from '../../support/uploads';
import { publishWorkflow } from '../../support/workflows';
import { personaPage } from '../../support/ui';

test.describe.configure({ timeout: 120_000 });

let inst: Institution;
let workflowId: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  workflowId = await publishWorkflow(Api.as(inst.members.designer), `schemaVersion: "1"
name: Documents ${Date.now()}
description: asks the client for documents
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
    name: Ask for documents
    type: client.request
    config:
      title: Please send your latest bank statement
      items:
        - { key: statement, label: Bank statement, type: file }
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

test.describe('UPL-01 Upload a requested document from the portal', { tag: ['@client', '@UPL-01', '@UPL-02', '@CLI-05'] }, () => {
  test('the client sees a virus refused, uploads a clean statement, sends it; the team finds it on the case', async ({ browser }) => {
    const email = uniqueEmail('portal-upload', 'customers.example');
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(started, 202);
    const caseId = started.body.caseId as string;
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'pending_client');
    const client = await clientSignIn(inst.bank, email);

    const page = await personaPage(browser, inst.bank.key, client, `/portal/cases/${caseId}`);
    const request = page.getByTestId('client-request').filter({ hasText: 'Please send your latest bank statement' });
    const input = request.getByLabel('Bank statement');
    await input.setInputFiles({ name: 'statement-virus.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('x', { trailer: EICAR }) });
    await expect(request.getByTestId('upload').filter({ hasText: 'statement-virus.pdf' })).toHaveAttribute('data-status', 'rejected', { timeout: 30_000 });
    await expect(request.getByText('malware detected')).toBeVisible();
    await expect(request.getByRole('button', { name: 'Send answer' })).toBeDisabled();

    await input.setInputFiles({ name: 'statement.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Statement March') });
    await expect(request.getByTestId('upload').filter({ hasText: 'statement.pdf' }).last()).toHaveAttribute('data-status', 'available', { timeout: 30_000 });
    await request.getByRole('button', { name: 'Send answer' }).click();
    await expect(page.getByText('Thank you')).toBeVisible();

    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'completed');
    const admin = await personaPage(browser, inst.bank.key, inst.bank.admin, `/app/cases/${caseId}`);
    const files = admin.getByTestId('case-file');
    await expect(files).toHaveCount(1);
    await expect(files.first()).toContainText('statement.pdf');
    await expect(files.first()).toContainText('scanned clean');
    const download = admin.waitForEvent('download');
    await files.first().getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('statement.pdf');
  });
});
