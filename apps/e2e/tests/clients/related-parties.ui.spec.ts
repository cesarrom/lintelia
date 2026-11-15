import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { applyAsClient, prepareInstitution, publishForm, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow, workflowFixture } from '../../support/workflows';
import { personaPage } from '../../support/ui';

test.describe.configure({ timeout: 150_000 });

/** CLI-08 in the browser: the applicant lists a beneficial owner, who joins with their own link and verifies. */
let inst: Institution;
let publicKey: string;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' }, connections: ['didit'] });
  const designer = Api.as(inst.members.designer);
  const partyWorkflow = await publishWorkflow(designer, workflowFixture('party-verification', { DIDIT: inst.connections.didit }));
  const workflowId = await publishWorkflow(designer, workflowFixture('kyb', { PARTY_WORKFLOW: partyWorkflow }));
  ({ publicKey } = await publishForm(designer, inst.bank, workflowId));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CLI-08 Business onboarding: invite beneficial owners who verify themselves', { tag: ['@client', '@CLI-08', '@CLI-09', '@SCN-09'] }, () => {
  test('the applicant adds a beneficial owner in the portal; the owner joins from the e-mail and verifies; the review starts', async ({ browser }) => {
    const { caseId, client } = await applyAsClient(inst.bank, publicKey, { companyName: 'Widgets Ltd' });
    const ubo = uniqueEmail('owner', 'widgets.example');
    const applicant = await personaPage(browser, inst.bank.key, client, `/portal/cases/${caseId}`);
    const request = applicant.getByTestId('client-request').filter({ hasText: 'Tell us who owns and runs the company' });
    await request.getByLabel('Role').selectOption('ubo');
    await request.getByLabel('Name').fill('Olive Owner');
    await request.getByLabel('E-mail').fill(ubo);
    const since = Date.now() - 1000;
    await request.getByRole('button', { name: 'Invite' }).click();
    await expect(request.getByTestId('party').filter({ hasText: ubo })).toContainText('Invited');
    await request.getByRole('button', { name: "That's everyone" }).click();

    const mail = await waitForEmail({ tenant: inst.bank.key, to: ubo, since });
    const { url } = linkWithParam(mail, 'party');
    const owner = await (await browser.newContext()).newPage();
    await owner.goto(url.toString());
    await expect(owner).toHaveURL(new RegExp(`/portal/cases/${caseId}`));
    // The owner sees their own step, not the applicant's application.
    await expect(owner.getByText(client.email)).toHaveCount(0);
    const verify = owner.getByTestId('client-request').filter({ hasText: 'Verify your identity' });
    await verify.getByTestId('client-action').click({ timeout: 30_000 });
    await owner.frameLocator('iframe[title="Verify your identity"]').getByRole('button', { name: /Approve/ }).click();

    const task = await waitForTask(Api.as(inst.members.analyst), caseId, { timeoutMs: 30_000 });
    expect(task.title).toContain('Widgets Ltd');
    const kase = await Api.as(inst.members.analyst).get(`/cases/${caseId}`);
    expect(kase.body.parties).toEqual([expect.objectContaining({ email: ubo, role: 'ubo', status: 'completed', verification: 'approved' })]);
  });
});
