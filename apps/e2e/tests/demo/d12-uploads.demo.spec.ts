import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { clientSignIn, prepareInstitution, waitForCase } from '../../support/scenario';
import { EICAR, pdfBytes } from '../../support/uploads';
import { publishWorkflow } from '../../support/workflows';
import { beat, endScenes, focus, recordedContext, scene, still, unfocus, demoMember } from '../../support/demo';

/** D12 (C1): a file with a test virus is refused, a clean statement is accepted, the team sees it scanned clean. */
test.describe.configure({ timeout: 300_000 });

test('d12 malware refused, clean statement accepted', async ({ browser }) => {
  const inst = await prepareInstitution({ name: 'Northwind Bank' });
  try {
    const designer = Api.as(await demoMember(inst.bank, 'Dana Designer', 'flow_designer'));
    const workflowId = await publishWorkflow(designer, `schemaVersion: "1"
name: Documents
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
    const email = 'ada.applicant@customers.example';
    const started = await inst.bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email } });
    expectStatus(started, 202);
    const caseId = started.body.caseId as string;
    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'pending_client');
    const client = await clientSignIn(inst.bank, email);

    const ph = await recordedContext(browser, 'customer', { app: 'phone', session: client, url: inst.bank.url(`/portal/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('client-request').filter({ hasText: 'Please send your latest bank statement' })).toBeVisible({ timeout: 30_000 }); } });
    const pp = ph.page;
    const request = pp.getByTestId('client-request').filter({ hasText: 'Please send your latest bank statement' });
    const input = request.getByLabel('Bank statement');
    await beat(pp, 1500);
    scene('Malware refused', 'customer');
    await input.setInputFiles({ name: 'test-virus.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('x', { trailer: EICAR }) });
    await expect(request.getByTestId('upload').filter({ hasText: 'test-virus.pdf' })).toHaveAttribute('data-status', 'rejected', { timeout: 30_000 });
    await focus(pp, request.getByText('malware detected'));
    await beat(pp, 6500);
    await still(pp, 'phone-malware-refused');
    await unfocus(pp);
    scene('Clean file accepted', 'customer');
    await input.setInputFiles({ name: 'statement.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Statement March') });
    await expect(request.getByTestId('upload').filter({ hasText: 'statement.pdf' }).last()).toHaveAttribute('data-status', 'available', { timeout: 30_000 });
    await beat(pp, 4500);
    await request.getByRole('button', { name: 'Send answer' }).click();
    await expect(pp.getByText('Thank you')).toBeVisible();
    await beat(pp, 2500);

    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'completed');
    const tm = await recordedContext(browser, 'team', { app: 'web', session: inst.bank.admin, url: inst.bank.url(`/app/cases/${caseId}`),
      ready: async (p) => { await expect(p.getByTestId('case-file').first()).toBeVisible({ timeout: 30_000 }); } });
    scene('Scanned clean, downloadable', 'team');
    await focus(tm.page, tm.page.getByTestId('case-file').first());
    await beat(tm.page, 7000);
    await still(tm.page, 'team-file-scanned');
    await unfocus(tm.page);
    endScenes();
    await ph.close(); await tm.close();
  } finally {
    await deleteTenant(inst.bank);
  }
});
