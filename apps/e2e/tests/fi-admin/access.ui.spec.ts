import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, uniqueEmail, type TenantHandle } from '../../support/factories';
import { minimalWorkflowYaml } from '../../support/workflows';
import { idpUser, setUpSso, ssoSignInWithoutBrowser } from '../../support/sso';
import { openAsTenantUser, openPlatformAsStaff, personaPage } from '../../support/ui';

/**
 * Who sees what, in the back office (docs/plans/15): custom permissions and extended system roles on the Roles page
 * (FIA-13, FIA-15), who may use a workflow set by a designer and decided by an administrator (FIA-14), roles from the
 * identity provider (FIA-16), a second approver (FIA-19), staff restoring access (STAFF-08).
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

let bank: TenantHandle;
let designer: Awaited<ReturnType<typeof addMember>>;
test.beforeAll(async () => {
  bank = await createTenant();
  designer = await addMember(bank, { roles: ['flow_designer'], label: 'designer' });
});
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('FIA-13/15 The Roles page', { tag: ['@fi-admin', '@FIA-13', '@FIA-15'] }, () => {
  test('an administrator names a permission, extends a system role with it and sees it in the matrix and the role page', async ({ page }) => {
    await addMember(bank, { roles: ['reviewer'], label: 'reviewer' });
    await openAsTenantUser(page, bank.key, bank.admin, '/app/roles');
    await page.getByRole('button', { name: 'New permission' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Waive fees');
    await expect(dialog.getByLabel('Key')).toHaveValue('custom:waive_fees');
    await dialog.getByLabel('Category').fill('Servicing');
    await dialog.getByRole('button', { name: 'Create permission' }).click();
    await expect(page.getByText('Permission custom:waive_fees created: nobody holds it yet')).toBeVisible();

    const reviewer = page.getByTestId('role-card').filter({ has: page.getByRole('heading', { name: /^Reviewer/ }) });
    await expect(reviewer.getByTestId('role-members')).toHaveText('1 member');
    await reviewer.getByRole('button', { name: 'Extend' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: 'Waive fees', exact: true }).check();
    await dialog.getByRole('button', { name: 'Save extension' }).click();
    await expect(page.getByText('Role updated')).toBeVisible();
    await expect(reviewer.getByText('Waive fees', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Matrix' }).click();
    await expect(page.getByLabel('Reviewer holds Waive fees')).toBeVisible();
    await page.getByRole('tab', { name: 'Custom permissions' }).click();
    await expect(page.getByTestId('custom-permission-row').filter({ hasText: 'custom:waive_fees' })).toContainText('Administrator, Reviewer');

    await page.getByRole('tab', { name: 'Roles' }).click();
    await reviewer.getByRole('link', { name: 'Reviewer' }).click();
    await expect(page.getByTestId('role-title')).toContainText('Reviewer');
    await expect(page.locator('[data-permission="custom:waive_fees"]')).toBeVisible();
    await expect(page.getByTestId('role-member')).toHaveCount(1);
  });
});

test.describe('FIA-14 Who may use a workflow', { tag: ['@fi-admin', '@FIA-14'] }, () => {
  test('a designer restricts who may start a workflow; the publication waits for an administrator, who approves it', async ({ browser }) => {
    const created = await Api.as(designer).post('/workflows', { yaml: minimalWorkflowYaml('Fee waiver') });
    expectStatus(created, 201);
    const page = await personaPage(browser, bank.key, designer, `/app/workflows/${created.body.id}`);
    await expect(page.getByTestId('workflow-node')).toHaveCount(2, { timeout: 45_000 });
    await page.getByTestId('wf-settings').click();
    const dialog = page.getByRole('dialog');
    const start = dialog.getByTestId('wf-access-start');
    await start.getByLabel('Only some members').check();
    await start.getByRole('checkbox', { name: 'Who may start it: Waive fees' }).check();
    await dialog.getByTestId('wf-settings-save').click();
    await page.getByRole('button', { name: 'Save Workflow' }).click();
    await expect.poll(async () => (await Api.as(designer).get(`/workflows/${created.body.id}`)).body.yaml, { timeout: 10_000 }).toContain('custom:waive_fees');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Sent for approval: another administrator must approve it')).toBeVisible();

    const admin = await personaPage(browser, bank.key, bank.admin, '/app/access-changes');
    const change = admin.getByTestId('access-change').filter({ hasText: 'Fee waiver' });
    await expect(change).toHaveAttribute('data-status', 'pending_approval');
    await change.getByRole('button', { name: 'Approve' }).click();
    await admin.getByRole('dialog').getByLabel('Note (optional)').fill('Fee desk only');
    await admin.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(admin.getByText('Approved', { exact: true })).toBeVisible();
    await admin.getByRole('tab', { name: /History/ }).click();
    await expect(admin.getByTestId('access-change').filter({ hasText: 'Fee waiver' })).toHaveAttribute('data-status', 'applied');
  });
});

test.describe('FIA-16 Roles from the identity provider, in the settings', { tag: ['@fi-admin', '@FIA-16'] }, () => {
  test('once single sign-on is linked, the administrator maps groups to roles and previews; IdP members are read-only in the team', async ({ page }) => {
    const domain = `${bank.key}.corp.example`;
    await setUpSso(bank, { domain });
    expectStatus(await bank.adminApi.put('/sso/settings', { jit: { enabled: true, defaultRoles: [] } }), 200);
    await openAsTenantUser(page, bank.key, bank.admin, '/app/settings?tab=security');
    const card = page.getByTestId('idp-roles');
    await expect(card.getByTestId('idp-roles-state')).toHaveAttribute('data-linked', 'yes');
    await expect(card.getByTestId('idp-roles-state')).toContainText(domain);
    for (const [group, role] of [['Lintelia-Admins', 'admin'], ['KYC-Analysts', 'reviewer']]) {
      await card.getByRole('button', { name: 'Add a group' }).click();
      await card.getByLabel('Group', { exact: true }).last().fill(group);
      await card.getByLabel('Role of the group').last().selectOption(role);
    }
    await card.getByRole('button', { name: "Preview the members' roles" }).click();
    await expect(card.getByTestId('role-preview-summary')).toContainText(`Administrators afterwards: ${bank.adminEmail}`);
    await card.getByRole('button', { name: 'Save mappings' }).click();
    await expect(page.getByText('Group mappings saved')).toBeVisible();

    // Someone of the SSO domain signs in with the analysts' group.
    const email = `kyc.analyst@${domain}`;
    await idpUser(email, { groups: ['KYC-Analysts'] });
    const discover = await Api.anonymous(bank.key).get(`/auth/sso/discover?email=${encodeURIComponent(email)}`);
    await ssoSignInWithoutBrowser(discover.body.redirectUrl, email);
    await page.goto(bank.url('/app/users'));
    const row = page.getByTestId('member-row').filter({ hasText: email });
    await expect(row).toHaveAttribute('data-managed', 'idp');
    await expect(row).toContainText('Reviewer');
    await expect(row.getByRole('combobox')).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Edit roles' })).toHaveCount(0);
  });
});

test.describe('FIA-19 A second administrator', { tag: ['@fi-admin', '@FIA-19'] }, () => {
  test('with the policy on, a role given in the team waits; another administrator approves it in Access changes', async ({ page, browser }) => {
    const second = await addMember(bank, { roles: ['admin'], label: 'second-admin' });
    const email = uniqueEmail('support', `${bank.key}.example`);
    expectStatus(await bank.adminApi.post('/users', { email, name: 'Sam Support', roleIds: ['support_agent'] }), 200);

    await openAsTenantUser(page, bank.key, bank.admin, '/app/settings?tab=security');
    await page.getByLabel('Require a second administrator for changes that grant access').click();
    await expect(page.getByText('A second administrator is now required')).toBeVisible();

    await page.goto(bank.url('/app/users'));
    const row = page.getByTestId('member-row').filter({ hasText: email });
    await row.getByRole('combobox', { name: `Role of ${email}` }).click();
    await page.getByRole('option', { name: 'Auditor' }).click();
    await expect(page.getByText('Sent for approval: another administrator must approve it')).toBeVisible();

    const approver = await personaPage(browser, bank.key, second, '/app/access-changes');
    const change = approver.getByTestId('access-change').filter({ hasText: email });
    await change.getByRole('button', { name: 'Approve' }).click();
    await approver.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(approver.getByText('Approved', { exact: true })).toBeVisible();
    await expect.poll(async () => ((await bank.adminApi.get('/users')).body as Array<{ email: string; roles: string[] }>).find((m) => m.email === email)?.roles).toEqual(['auditor']);
  });
});

test.describe('STAFF-08 Restore access from the platform console', { tag: ['@staff', '@STAFF-08'] }, () => {
  test('staff restore an administrator with the verified ticket', async ({ page }) => {
    await openPlatformAsStaff(page);
    await page.getByTestId('institution-row').filter({ hasText: bank.key }).getByRole('button', { name: 'Restore access' }).click();
    const dialog = page.getByRole('dialog');
    const email = uniqueEmail('restored', `${bank.key}.example`);
    await dialog.getByLabel("Administrator's e-mail").fill(email);
    await dialog.getByLabel('Name').fill('Restored Admin');
    await dialog.getByLabel('Support ticket (where the request was verified)').fill('SUP-777');
    await dialog.getByLabel('Reason').fill('Their only administrator left the bank');
    await dialog.getByRole('button', { name: 'Restore access' }).click();
    await expect(page.getByText(`Invitation sent to ${email} as administrator`)).toBeVisible();
  });
});
