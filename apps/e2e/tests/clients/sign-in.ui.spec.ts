import { test, expect } from '@playwright/test';
import { createTenant, deleteTenant, uniqueEmail, type TenantHandle } from '../../support/factories';
import { otpCode, waitForEmail } from '../../support/mailbox';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

const session = async (page: import('@playwright/test').Page) =>
  JSON.parse((await page.evaluate(() => localStorage.getItem('fintivio.session'))) ?? 'null');

test.describe("CLI-01 Create an account and sign in on the institution's portal", { tag: ['@client', '@CLI-01'] }, () => {
  test('a prospective client creates an account on the branded sign-on page', async ({ page }) => {
    const email = uniqueEmail('retail', 'customers.example');
    await page.goto(bank.url('/sign-on'));
    await expect(page.getByText(bank.tenant.name)).toBeVisible();
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('Full name').fill('Rita Retail');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/^Password/).fill('client-password-123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).not.toHaveURL(/sign-on/);
    expect((await session(page)).user).toMatchObject({ email, kind: 'client' });
  });

  test("clients land in the client portal, not the institution's back office", async ({ page }) => {
    const email = uniqueEmail('portal', 'customers.example');
    await page.goto(bank.url('/sign-on'));
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/^Password/).fill('client-password-123');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/portal/);
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /my applications/i })).toBeVisible();
  });
});

test.describe('CLI-02 Passwordless sign-in with an e-mailed code', { tag: ['@client', '@CLI-02'] }, () => {
  test('a client signs in with a one-time code, without a password', async ({ page }) => {
    const email = uniqueEmail('otp', 'customers.example');
    await page.goto(bank.url('/sign-on'));
    await page.getByLabel('Email').fill(email);
    const since = Date.now() - 1000;
    await page.getByRole('button', { name: /e-?mail me a code/i }).click();
    const code = otpCode(await waitForEmail({ tenant: bank.key, to: email, since }));
    await page.getByLabel('Code', { exact: true }).fill(code);
    await page.getByRole('button', { name: /verify|continue/i }).click();
    await expect(page).toHaveURL(/\/portal/);
    expect((await session(page)).user).toMatchObject({ email, kind: 'client' });
  });
});
