import { test, expect } from '../../support/test';
import { completeSecondFactor } from '../../support/ui';
import { Api, expectStatus } from '../../support/api';
import { staffSession, uniqueKey } from '../../support/factories';
import { linkWithParam, waitForEmail } from '../../support/mailbox';
import { tenantUrl } from '../../support/env';

test.describe('FIA-01 Accept the invitation and sign in for the first time', { tag: ['@fi-admin', '@FIA-01'] }, () => {
  test('the invitee chooses a password from the e-mail link and lands in the workspace as administrator', async ({ page }) => {
    const key = uniqueKey();
    const email = `owner@${key}.example`;
    const since = Date.now() - 1000;
    const staff = Api.as(await staffSession());
    expectStatus(await staff.post('/tenants', { name: `Invite Bank ${key}`, domain: key, invitee: [{ email, role: 'admin' }] }), 201);

    const mail = await waitForEmail({ tenant: key, to: email, since });
    const { url } = linkWithParam(mail, 'invitation');
    expect(url.host).toBe(new URL(tenantUrl(key)).host);

    await page.goto(url.toString());
    await page.getByLabel('Full name').fill('Olivia Owner');
    await page.getByLabel(/^Password/).fill('owner-password-123');
    await page.getByRole('button', { name: 'Activate account' }).click();
    // New institutions require a second factor: the administrator enrols an authenticator app (recovery codes shown once).
    await completeSecondFactor(page, email);
    await expect(page).toHaveURL(/\/app\/dashboard$/);

    await page.goto(tenantUrl(key, '/app/users'));
    await expect(page.getByRole('cell', { name: email })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(email) }).getByText('admin')).toBeVisible();

    // The link works once.
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(url.toString());
    await page.getByLabel(/^Password/).fill('another-password-123');
    await page.getByRole('button', { name: 'Activate account' }).click();
    await expect(page.getByText('Invitation is invalid or has expired')).toBeVisible();

    await staff.put(`/tenants/${key}`, { data: { status: 'suspended' } });
    await staff.delete(`/tenants/${key}`);
  });
});
