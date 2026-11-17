import { test, expect } from '../../support/test';
import { Api } from '../../support/api';
import { createTenant, deleteTenant, uniqueEmail, type TenantHandle } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { openAsTenantUser, completeSecondFactor } from '../../support/ui';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('FIA-05 Define custom roles from the permission catalogue', { tag: ['@fi-admin', '@FIA-05'] }, () => {
  test('the administrator composes a custom role; system roles are read-only', async ({ page }) => {
    await openAsTenantUser(page, bank.key, bank.admin, '/app/roles');
    const reviewer = page.getByTestId('role-card').filter({ has: page.getByRole('heading', { name: /^Reviewer/ }) });
    await expect(reviewer.getByText('System')).toBeVisible();
    await expect(reviewer.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    await page.getByRole('button', { name: 'New custom role' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Loan officer');
    await dialog.getByLabel('Description').fill('Starts loan applications and works the credit queue');
    for (const permission of ['View clients', 'View cases', 'Start cases', 'Work tasks']) {
      await dialog.getByRole('checkbox', { name: permission, exact: true }).check();
    }
    await dialog.getByRole('button', { name: 'Create role' }).click();

    const card = page.getByTestId('role-card').filter({ has: page.getByRole('heading', { name: 'Loan officer' }) });
    await expect(card).toBeVisible();
    for (const permission of ['View clients', 'View cases', 'Start cases', 'Work tasks']) {
      await expect(card.getByText(permission, { exact: true })).toBeVisible();
    }
  });
});

test.describe('FIA-04 Manage the team (invite, roles, deactivate)', { tag: ['@fi-admin', '@FIA-04'] }, () => {
  test('an invited reviewer activates the account and only sees what a reviewer may use', async ({ page, browser }) => {
    const email = uniqueEmail('new-reviewer', `${bank.key}.example`);
    await openAsTenantUser(page, bank.key, bank.admin, '/app/users');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Name').fill('Rae Reviewer');
    await page.getByRole('combobox', { name: 'Role', exact: true }).click();
    await page.getByRole('option', { name: 'Reviewer', exact: true }).click();
    const since = Date.now() - 1000;
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText(`Invitation sent to ${email}`)).toBeVisible();

    const invitation = await waitForEmail({ tenant: bank.key, to: email, since });
    const { url } = linkWithParam(invitation, 'invitation');
    const invitee = await (await browser.newContext()).newPage();
    await invitee.goto(url.toString());
    await invitee.getByLabel('Full name').fill('Rae Reviewer');
    await invitee.getByLabel(/^Password/).fill('reviewer-password-123');
    await invitee.getByRole('button', { name: 'Activate account' }).click();
    await completeSecondFactor(invitee, email);
    await expect(invitee).toHaveURL(/\/app\/dashboard$/);
    const nav = invitee.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Tasks' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Cases' })).toBeVisible();
    for (const hidden of ['Team', 'Roles', 'Audit log', 'Webhooks', 'API Keys']) {
      await expect(nav.getByRole('link', { name: hidden })).toHaveCount(0);
    }

    // Deactivating signs the member out everywhere. (The session is read first: once deactivated, the invitee's page
    // may notice on its next request and drop it.)
    const session = JSON.parse((await invitee.evaluate(() => localStorage.getItem('fintivio.session')))!);
    await page.reload();
    const row = page.getByTestId('member-row').filter({ hasText: email });
    await row.getByRole('button', { name: 'Deactivate' }).click();
    await expect(row).toContainText('Deactivated');
    expect((await Api.as(session).get('/tasks')).status).toBe(401);
  });

  test('an administrator changes a member role from the team page', async ({ page }) => {
    const email = uniqueEmail('promoted', `${bank.key}.example`);
    expect((await bank.adminApi.post('/users', { email, name: 'Pat Promoted', roleIds: ['reviewer'] })).status).toBe(200);
    await openAsTenantUser(page, bank.key, bank.admin, '/app/users');
    const row = page.getByTestId('member-row').filter({ hasText: email });
    await row.getByRole('combobox', { name: `Role of ${email}` }).click();
    await page.getByRole('option', { name: 'Senior reviewer' }).click();
    await expect(page.getByText('Role changed')).toBeVisible();
    const members = await bank.adminApi.get('/users');
    expect((members.body as any[]).find((m) => m.email === email).roles).toEqual(['senior_reviewer']);
  });
});
