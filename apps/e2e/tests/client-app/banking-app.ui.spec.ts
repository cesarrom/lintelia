import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { DEFAULT_PASSWORD, deleteTenant, uniqueEmail } from '../../support/factories';
import { decide, prepareInstitution, waitForTask, type Institution } from '../../support/scenario';
import { pdfBytes } from '../../support/uploads';
import { useSession } from '../../support/ui';
import { bankingCustomer, installBankingApp, systemApi } from '../../support/client-app';

/**
 * The banking app as clients use it (docs/plans/11): sign up, open a first account with an identity document and the
 * team's check, then everyday banking — balances, moving money, freezing a card — on a computer and a phone.
 */
test.describe.configure({ timeout: 180_000 });

let inst: Institution;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  await installBankingApp(Api.as(inst.members.designer));
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('APP-05 A newcomer signs up and opens an account in the app', { tag: ['@client', '@APP-05', '@APP-06'] }, () => {
  test('sign-up with consents, the onboarding journey with an ID upload, the team approves, the account appears', async ({ page }) => {
    const email = uniqueEmail('nora', 'customers.example');
    await page.goto(inst.bank.url('/sign-on?client=1'));
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('Full name').fill('Nora Newcomer');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password (at least 10 characters)').fill(DEFAULT_PASSWORD);
    await page.getByLabel('Mobile number').fill('+44 7700 900333');
    const create = page.getByRole('button', { name: 'Create account' });
    await expect(create).toBeDisabled(); // the terms and the privacy notice first
    await page.getByLabel('I accept the Terms and conditions').check();
    await page.getByLabel('I accept the Privacy notice').check();
    await create.click();

    // The app, in the bank's colours; the welcome workflow greets the new client.
    await expect(page.getByTestId('client-app')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('hero')).toContainText("Let's get you started");
    await expect(page.getByTestId('unread-count')).toHaveText('1', { timeout: 20_000 });
    await expect(page.getByTestId('app-nav').filter({ hasText: 'Accounts' })).toHaveCount(0);

    await page.getByTestId('callout').getByRole('button', { name: 'Get started' }).click();
    const journey = page.getByTestId('journey');
    await expect(page.getByTestId('screen-title')).toHaveText("Let's get to know you");
    await expect(page.getByLabel('Full legal name')).toHaveValue('Nora Newcomer');
    await expect(page.getByLabel('Mobile number')).toHaveValue('+44 7700 900333');
    await page.getByTestId('screen-button-continue').click();
    await expect(page.getByTestId('error-dateOfBirth')).toHaveText('Required');
    await page.getByLabel('Date of birth').fill('1993-07-21');
    await page.getByLabel('Home address').fill('4 Canal Street, Manchester M1 3HE');
    await page.getByLabel('Employment').selectOption('Employed full-time');
    await page.getByTestId('screen-button-continue').click();

    await expect(page.getByTestId('screen-title')).toHaveText('Confirm your identity');
    await expect(journey.getByTestId('journey-stages').locator('[data-status="done"]')).toHaveCount(1);
    await page.locator('input[type=file]').setInputFiles({ name: 'passport.pdf', mimeType: 'application/pdf', buffer: await pdfBytes('Passport — Nora Newcomer') });
    await expect(page.getByTestId('upload')).toHaveAttribute('data-status', 'available', { timeout: 30_000 });
    await page.getByText('I confirm the information I gave is true and complete').click();
    await page.getByTestId('screen-button-continue').click();
    await expect(page.getByTestId('journey-waiting')).toBeVisible();
    const reference = await journey.getAttribute('data-case-reference');

    // The bank's reviewer checks the identity document.
    const analyst = Api.as(inst.members.analyst);
    const cases = await inst.bank.adminApi.get('/cases');
    const kase = (cases.body as any[]).find((c) => c.reference === reference);
    const task = await waitForTask(analyst, kase.id);
    expectStatus(await analyst.post(`/tasks/${task.id}/claim`), 200);
    expectStatus(await decide(analyst, task.id, 'approve', 'Passport checked'), [200, 201]);

    await expect(page.getByTestId('journey-done')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('journey-done-title')).toHaveText('Your account is open');
    await page.getByTestId('journey-finish').click();
    await expect(page.getByTestId('account-card')).toHaveCount(1);
    await expect(page.getByTestId('account-balance')).toHaveText('£0.00');
    await expect(page.getByTestId('app-nav').filter({ hasText: 'Cards' })).toBeVisible();
    await page.getByTestId('app-nav').filter({ hasText: 'Cards' }).click();
    await expect(page.getByTestId('payment-card')).toHaveAttribute('data-status', 'ordered');
    await expect(page.getByTestId('card-status')).toHaveText('On its way');
  });
});

test.describe('APP-04 Everyday banking in the app', { tag: ['@client', '@APP-04', '@APP-03'] }, () => {
  test('a customer moves money between accounts and freezes a card', async ({ page }) => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Casey Customer', current: 1200, savings: 300 });
    await useSession(page, casey.session);
    await page.goto(inst.bank.url('/portal'));
    await expect(page.getByTestId('hero-value')).toHaveText('£1,500.00');
    await expect(page.getByTestId('transaction')).toContainText(['Coffee House']);

    await page.getByTestId('quick-action').filter({ hasText: 'Move money' }).click();
    await expect(page.getByTestId('screen-title')).toHaveText('Move money between your accounts');
    await page.getByLabel('From').selectOption('cur-1');
    await page.getByLabel('To').selectOption('sav-1');
    await page.getByLabel('Amount').fill('5000');
    await page.getByTestId('screen-button-continue').click();
    await expect(page.getByTestId('screen-title')).toHaveText("We can't make this transfer");
    await page.getByTestId('screen-button-back').click();
    await expect(page.getByLabel('Amount')).toHaveValue('5000');
    await page.getByLabel('Amount').fill('200');
    await page.getByLabel('Reference').fill('Savings top-up');
    await page.getByTestId('screen-button-continue').click();
    await expect(page.getByTestId('screen-content')).toContainText('£200.00 from Everyday account to Rainy day saver');
    await page.getByTestId('screen-button-move').click();
    // Seven steps run before the result (debits, credits, transactions, the notification): slower on a busy machine.
    await expect(page.getByTestId('journey-done-title')).toHaveText('Money moved', { timeout: 30_000 });
    await page.getByTestId('journey-finish').click();

    await expect(page).toHaveURL(/\/portal\/p\/accounts$/);
    await expect(page.locator('[data-account="cur-1"]').getByTestId('account-balance')).toHaveText('£1,000.00');
    await expect(page.locator('[data-account="sav-1"]').getByTestId('account-balance')).toHaveText('£500.00');
    await expect(page.getByTestId('transaction').filter({ hasText: 'Savings top-up' })).toHaveCount(2);

    await page.getByTestId('app-nav').filter({ hasText: 'Cards' }).click();
    await page.getByTestId('freeze-card').click();
    await expect(page.getByText('Card frozen')).toBeVisible();
    await expect(page.getByTestId('payment-card')).toHaveAttribute('data-status', 'frozen');
    await page.getByTestId('unfreeze-card').click();
    await expect(page.getByTestId('payment-card')).toHaveAttribute('data-status', 'active');

    // Opening an account detail page from the account card.
    await page.getByTestId('app-nav').filter({ hasText: 'Accounts' }).click();
    await page.locator('[data-account="sav-1"]').click();
    await expect(page).toHaveURL(/\/portal\/p\/account\?key=sav-1$/);
    await expect(page.getByTestId('detail-balance')).toHaveText('£500.00');
  });

  test('on a phone: the terms first, then tab bar, "More" for the other pages, notifications', async ({ browser }) => {
    // Registered by the bank's systems: the app asks for the terms before anything else.
    const casey = await bankingCustomer(inst.bank, system, { name: 'Phoebe Phone', acceptedTerms: false });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await useSession(page, casey.session);
    await page.goto(inst.bank.url('/portal'));
    await expect(page.getByTestId('consent-gate')).toBeVisible();
    await expect(page.getByTestId('hero')).toHaveCount(0);
    await page.getByLabel('I accept the Terms and conditions').check();
    await expect(page.getByTestId('accept-consents')).toBeDisabled();
    await page.getByLabel('I accept the Privacy notice').check();
    await page.getByTestId('accept-consents').click();
    await expect(page.getByTestId('hero')).toBeVisible();
    await expect(page.getByTestId('app-tab')).toHaveText(['Home', 'Accounts', 'Cards', 'Insights']);
    await page.getByTestId('app-tab').filter({ hasText: 'Insights' }).click();
    await expect(page.getByTestId('app-page-title')).toHaveText('Insights');
    await expect(page.getByTestId('stat')).toHaveCount(3);
    await page.getByTestId('app-tab-more').click();
    await page.getByRole('dialog').getByTestId('app-nav').filter({ hasText: 'Help' }).click();
    await expect(page.getByTestId('app-page-title')).toHaveText('Help');
    await page.getByTestId('faq').getByText('I lost my card. What do I do?').click();
    await expect(page.getByTestId('faq')).toContainText('We block it at once');
    await page.getByTestId('notifications-bell').click();
    await expect(page.getByTestId('notification').first()).toContainText('Welcome aboard');
    await context.close();
  });
});
