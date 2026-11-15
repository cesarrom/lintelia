import { test, expect } from '@playwright/test';
import { createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { expectStatus } from '../../support/api';
import { idpUser, setUpSso } from '../../support/sso';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('FIA-06 Members sign in through their IdP', { tag: ['@fi-admin', '@FIA-06'] }, () => {
  test('e-mail first, redirect to the IdP, back in the workspace with the default role (JIT)', async ({ page }) => {
    const domain = `${bank.key}.corp.example`;
    const { issuer } = await setUpSso(bank, { domain });
    expectStatus(await bank.adminApi.put('/sso/settings', { enforce: true, jit: { enabled: true, defaultRoles: ['reviewer'] } }), 200);
    const email = `jane.doe@${domain}`;
    await idpUser(email, { name: 'Jane Doe' });

    await page.goto(bank.url('/sign-on'));
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /continue|sign in/i }).click();
    await expect(page).toHaveURL(new RegExp(`^${issuer}`));
    await page.locator('input[name=login]').fill(email);
    await page.locator('input[name=password]').fill('idp-password-1');
    await page.getByRole('button', { name: /sign-?in/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard$/);
    const session = JSON.parse((await page.evaluate(() => localStorage.getItem('fintivio.session'))) ?? '{}');
    expect(session.user.email).toBe(email);
    expect(session.user.userTenants[0].roleNames).toEqual(['reviewer']);
  });
});
