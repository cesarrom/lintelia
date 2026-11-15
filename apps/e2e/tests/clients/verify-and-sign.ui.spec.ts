import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { requireFake } from '../../support/fakes';
import { applyAsClient, prepareInstitution, publishForm, waitForCase, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';
import { personaPage } from '../../support/ui';

test.describe.configure({ timeout: 150_000 });

/**
 * CLI-04 / CLI-06 in the browser: the client verifies their identity on Didit's page and signs on Documenso's page,
 * both embedded in the portal (local fakes speak the vendors' embed protocols); decisions arrive by webhook.
 */
let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  await requireFake('didit');
  await requireFake('documenso');
  inst = await prepareInstitution({ members: { designer: 'flow_designer' }, connections: ['didit', 'documenso'] });
  const designer = Api.as(inst.members.designer);
  const workflowId = await publishWorkflow(designer, workflowFixture('retail-account-opening', {
    DIDIT: inst.connections.didit, DOCUMENSO: inst.connections.documenso, REMIND_AFTER: 'P3D', EXPIRES_AFTER: 'P30D',
  }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CLI-04 Verify my identity, CLI-06 sign my agreement', { tag: ['@client', '@CLI-04', '@CLI-06', '@SCN-01'] }, () => {
  test('the client verifies on the vendor page, then signs, from the portal; the account is approved', async ({ browser }) => {
    const email = uniqueEmail('portal-kyc', 'customers.example');
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { email });
    const page = await personaPage(browser, inst.bank.key, client, `/portal/cases/${caseId}`);

    const verify = page.getByTestId('client-request').filter({ hasText: 'Verify your identity' });
    await verify.getByTestId('client-action').click({ timeout: 30_000 });
    const didit = page.frameLocator('iframe[title="Verify your identity"]');
    await didit.getByRole('button', { name: /Approve/ }).click();
    await expect(page.getByTestId('client-action-finished')).toBeVisible();

    const sign = page.getByTestId('client-request').filter({ hasText: 'Sign your agreement' });
    await sign.getByTestId('client-action').click({ timeout: 30_000 });
    const documenso = page.frameLocator('iframe[title="Sign your agreement"]');
    await expect(documenso.getByRole('heading', { name: 'Retail account agreement' })).toBeVisible();
    await documenso.getByRole('button', { name: 'Sign' }).click();

    await waitForCase(inst.bank.adminApi, caseId, (c) => c.status === 'approved', 30_000);
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 15_000 });

    // The team sees the verification, the signature and the signed agreement on the case.
    const admin = await personaPage(browser, inst.bank.key, inst.bank.admin, `/app/cases/${caseId}`);
    await expect(admin.getByTestId('case-record').filter({ hasText: 'Verification' })).toHaveAttribute('data-status', 'approved');
    await expect(admin.getByTestId('case-record').filter({ hasText: 'Signature request' })).toHaveAttribute('data-status', 'signed');
    await expect(admin.getByTestId('case-file').filter({ hasText: 'signed-' })).toBeVisible({ timeout: 20_000 });
  });
});
