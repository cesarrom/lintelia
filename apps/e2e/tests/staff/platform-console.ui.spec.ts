import { test, expect } from '@playwright/test';
import { Api } from '../../support/api';
import { env, tenantUrl } from '../../support/env';
import { acceptInvitation, createTenant, deleteTenant, login, staffSession, uniqueEmail, uniqueKey } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { openAsTenantUser, completeSecondFactor } from '../../support/ui';
import { openPlatformAsStaff, platformUrl, signInThroughForm } from '../../support/ui';

const cleanup: string[] = [];
test.afterAll(async () => {
  const staff = Api.as(await staffSession());
  for (const key of cleanup) {
    await staff.put(`/tenants/${key}`, { data: { status: 'suspended' } });
    await staff.delete(`/tenants/${key}`);
  }
});

test.describe('STAFF-01 Sign in to the platform console', { tag: ['@staff', '@STAFF-01'] }, () => {
  test('staff sign in on the platform host and land on institution management', async ({ page }) => {
    await signInThroughForm(page, platformUrl('/sign-on'), env.staff.email, env.staff.password);
    await expect(page).toHaveURL(/\/app\/platform\/institutions$/);
    await expect(page.getByRole('heading', { name: 'Institutions' })).toBeVisible();
    // Staff navigation only: no tenant work areas.
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Institutions', 'Support access', 'Connectors', 'Staff', 'Audit log']);
  });
});

test.describe('STAFF-02 Onboard a financial institution (console)', { tag: ['@staff', '@STAFF-02'] }, () => {
  test('the onboarding dialog creates the institution and e-mails its administrator an invitation', async ({ page }) => {
    const key = uniqueKey('console');
    cleanup.push(key);
    const adminEmail = `owner@${key}.example`;
    await openPlatformAsStaff(page);
    await page.getByRole('button', { name: 'Onboard institution' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Institution name').fill(`Console Bank ${key}`);
    await dialog.getByLabel('Workspace key').fill(key);
    await dialog.getByLabel('Administrator e-mail').fill(adminEmail);
    const since = Date.now() - 1000;
    await dialog.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByText(`invitation sent to ${adminEmail}`)).toBeVisible();
    const row = page.getByTestId('institution-row').filter({ hasText: key });
    await expect(row).toContainText(`Console Bank ${key}`);
    await expect(row).toContainText('Active');

    // The administrator can activate the account: the workspace works.
    const admin = await acceptInvitation({ tenant: key, email: adminEmail, since });
    expect(admin.user.userTenants[0].roleNames).toEqual(['admin']);
  });
});

test.describe('STAFF-03 Suspend and reactivate an institution', { tag: ['@staff', '@STAFF-03'] }, () => {
  test('suspending blocks sign-in to the institution until it is reactivated', async ({ page }) => {
    const key = uniqueKey('lifecycle');
    cleanup.push(key);
    const adminEmail = `owner@${key}.example`;
    const staff = Api.as(await staffSession());
    const since = Date.now() - 1000;
    expect((await staff.post('/tenants', { name: `Lifecycle Bank ${key}`, domain: key, invitee: [{ email: adminEmail, role: 'admin' }] })).status).toBe(201);
    await acceptInvitation({ tenant: key, email: adminEmail, since, password: 'lifecycle-password-1' });

    await openPlatformAsStaff(page);
    const row = page.getByTestId('institution-row').filter({ hasText: key });
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Suspend' }).click();
    await expect(row).toContainText('Suspended');
    expect((await login(key, adminEmail, 'lifecycle-password-1')).status).not.toBe(200);

    // The institution's sign-in page no longer knows it.
    const tenantPage = await (await page.context().browser()!.newContext()).newPage();
    await tenantPage.goto(tenantUrl(key, '/sign-on'));
    await expect(tenantPage.getByText(`Unknown institution "${key}.${env.baseDomain}"`)).toBeVisible();

    // (dispatchEvent: the confirmation toast may cover the last row of the table)
    await row.getByRole('button', { name: 'Reactivate' }).dispatchEvent('click');
    await expect(row).toContainText('Active');
    expect((await login(key, adminEmail, 'lifecycle-password-1')).status).toBe(200);
  });
});

test.describe('STAFF-06 Manage platform staff (console)', { tag: ['@staff', '@STAFF-06'] }, () => {
  test('a platform admin invites a support engineer, who only gets the support areas of the console', async ({ page, browser }) => {
    const email = uniqueEmail('support-engineer', 'fintivio.local');
    await openPlatformAsStaff(page);
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Staff', exact: true }).click();
    await page.getByRole('button', { name: 'Invite staff' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('E-mail').fill(email);
    await dialog.getByLabel('Name').fill('Sue Support');
    await dialog.getByRole('checkbox', { name: 'Support engineer' }).check();
    const since = Date.now() - 1000;
    await dialog.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByTestId('staff-row').filter({ hasText: email })).toContainText('Invited');

    const mail = await waitForEmail({ tenant: null, to: email, since });
    const { url } = linkWithParam(mail, 'invitation');
    const invitee = await (await browser.newContext()).newPage();
    await invitee.goto(url.toString());
    await invitee.getByLabel('Full name').fill('Sue Support');
    await invitee.getByLabel(/^Password/).fill('support-password-123');
    await invitee.getByRole('button', { name: 'Activate account' }).click();
    // Staff always enrol a second factor.
    await completeSecondFactor(invitee, email);
    await expect(invitee).toHaveURL(/\/app\/platform\/institutions$/);
    await expect(invitee.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(['Institutions', 'Support access']);
    await expect(invitee.getByRole('button', { name: 'Onboard institution' })).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByTestId('platform-audit-row').filter({ hasText: 'Staff invited' }).first()).toBeVisible();
  });
});

test.describe('STAFF-05 / FIA-11 Support access (console)', { tag: ['@staff', '@STAFF-05', '@FIA-11'] }, () => {
  test('staff request read-only access; the institution approves and revokes it; every use is audited', async ({ page, browser }) => {
    const bank = await createTenant();
    try {
      const staff = await staffSession();
      await openPlatformAsStaff(page);
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Support access' }).click();
      await page.getByRole('combobox', { name: 'Institution' }).click();
      await page.getByRole('option', { name: bank.tenant.name }).click();
      await page.getByLabel('Reason (ticket)').fill('Ticket 4711: applicant cannot submit the loan form');
      await page.getByLabel('Minutes').fill('30');
      await page.getByRole('button', { name: 'Request access' }).click();
      const row = page.getByTestId('support-grant-row').filter({ hasText: 'Ticket 4711' });
      await expect(row).toContainText('Pending');
      expect((await Api.as(staff, bank.key).get('/forms')).status).toBe(403);

      // The institution's administrator is told, and approves.
      await waitForEmail({ tenant: bank.key, to: bank.adminEmail, subject: 'Fintivio support asks for read-only access' });
      const admin = await (await browser.newContext()).newPage();
      await openAsTenantUser(admin, bank.key, bank.admin, '/app/support-access');
      const request = admin.getByTestId('support-request-row').filter({ hasText: env.staff.email });
      await request.getByRole('button', { name: 'Approve' }).click();
      await expect(request).toContainText('Active');
      await expect(row).toContainText('Active', { timeout: 10_000 });

      // Read-only: reads work, writes are refused.
      expect((await Api.as(staff, bank.key).get('/forms')).status).toBe(200);
      expect((await Api.as(staff, bank.key).post('/forms', { name: 'x', config: { components: [] } })).status).toBe(403);

      await request.getByRole('button', { name: 'Revoke' }).click();
      await expect(request).toContainText('Revoked');
      expect((await Api.as(staff, bank.key).get('/forms')).status).toBe(403);

      await admin.goto(bank.url('/app/audit'));
      for (const action of ['support_access.granted', 'support_access.used', 'support_access.revoked']) {
        await expect(admin.locator(`[data-action="${action}"]`).first()).toBeVisible();
      }
    } finally {
      await deleteTenant(bank);
    }
  });
});
