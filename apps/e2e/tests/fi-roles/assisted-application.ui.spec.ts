import { test, expect } from '../../support/test';
import { Api } from '../../support/api';
import { addClient, deleteTenant } from '../../support/factories';
import { linkWithParam, otpCode, waitForEmail } from '../../support/mailbox';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { claimFromQueue, decideTask, personaPage } from '../../support/ui';

// Multi-persona journey: several browser contexts, slower when the whole suite runs in parallel.
test.describe.configure({ timeout: 120_000 });

let inst: Institution;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', rm: 'relationship_manager', analyst: 'reviewer' } });
  const designer = Api.as(inst.members.designer);
  const created = await designer.post('/workflow-templates/loan-pre-approval/use');
  expect((await designer.post(`/workflows/${created.body.id}/publish`)).status).toBe(200);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('RM-01 Start an assisted application for a client', { tag: ['@relationship-manager', '@RM-01', '@RM-02', '@CLI-10'] }, () => {
  test('a relationship manager prepares a loan application; the client confirms it in the portal; a reviewer decides it', async ({ browser }) => {
    const client = await addClient(inst.bank, { name: 'Carla Customer' });
    const rm = await personaPage(browser, inst.bank.key, inst.members.rm, '/app/clients');
    await rm.getByTestId('client-row').filter({ hasText: client.email }).click();
    await rm.getByRole('button', { name: 'Start application' }).click();
    const dialog = rm.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Workflow' }).click();
    await rm.getByRole('option', { name: /Personal loan pre-approval/ }).click();
    await dialog.getByLabel('Loan amount').fill('25000');
    await dialog.getByLabel('Annual income').fill('85000');
    await dialog.getByRole('button', { name: 'Start application' }).click();

    await expect(rm).toHaveURL(/\/app\/cases\/[0-9a-f-]+$/);
    const reference = (await rm.getByTestId('case-reference').textContent())!.trim();
    await expect(rm.getByTestId('case-title')).toHaveText('Loan pre-approval: Carla Customer (25000)');
    await expect(rm.getByTestId('case-status')).toHaveText('Pending client');
    // RMs start and follow applications; they do not decide them.
    await expect(rm.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Tasks' })).toHaveCount(0);

    // The client follows the e-mail link, signs in with a code, checks the details and confirms with consent.
    const invitation = await waitForEmail({ tenant: inst.bank.key, to: client.email, subject: `Please review and confirm your application ${reference}` });
    const { url } = linkWithParam(invitation, 'case');
    const portal = await (await browser.newContext()).newPage();
    await portal.goto(url.toString());
    await expect(portal).toHaveURL(/\/sign-on/);
    await portal.getByLabel('Email').fill(client.email);
    const since = Date.now() - 1000;
    await portal.getByRole('button', { name: 'Email me a code' }).click();
    await portal.getByLabel('Code', { exact: true }).fill(otpCode(await waitForEmail({ tenant: inst.bank.key, to: client.email, since, subject: /code/i })));
    await portal.getByRole('button', { name: 'Continue' }).click();
    await expect(portal).toHaveURL(new RegExp(`/portal/cases/`));
    const confirmation = portal.getByTestId('confirm-application');
    await expect(confirmation).toContainText('25,000');
    await confirmation.getByRole('checkbox', { name: 'I confirm and consent' }).check();
    await confirmation.getByRole('button', { name: 'Confirm and submit' }).click();
    await expect(portal.getByTestId('portal-case-status')).toHaveText('Under review', { timeout: 20_000 });

    const analyst = await personaPage(browser, inst.bank.key, inst.members.analyst, '/app/tasks');
    await claimFromQueue(analyst, reference);
    await decideTask(analyst, 'Approve', 'Salary slips provided at the branch');
    await waitForEmail({ tenant: inst.bank.key, to: client.email, subject: `Your application ${reference}: approved`, timeoutMs: 20_000 });

    // The client gave consent; the RM follows the outcome of the cases they started.
    await rm.reload();
    await expect(rm.getByTestId('timeline').locator('[data-action="case.confirmed_by_client"]')).toBeVisible();
    await expect(rm.getByTestId('case-status')).toHaveText('Approved');
  });
});
