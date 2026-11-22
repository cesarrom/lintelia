import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { openAsTenantUser, useSession } from '../../support/ui';
import { appClient, bankingCustomer, installBankingApp, systemApi } from '../../support/client-app';
import { emvPayload, fakeCameraVideo, qrImage } from '../../support/payment-codes';
import { instrumentBrowser } from '../../support/visual/runtime';
import { publishWorkflow, screenBlocksWorkflowYaml } from '../../support/workflows';

/**
 * APP-12 UI building blocks (docs/plans/14) in the banking app: "Pay with QR" — a floating button opening a journey
 * full screen, a quick action opening it as a sheet, a link opening it in a dialog; the scanner (camera, photo, typed
 * code), fields shown on a condition, a screen that continues by itself after a countdown the client can stop. And
 * the designer's branding tools: presets, colours, fonts, button shapes, readability, currency.
 */
test.describe.configure({ timeout: 180_000 });

let inst: Institution;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  await installBankingApp(Api.as(inst.members.designer));
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const CAFE = emvPayload({ payee: 'Corner Cafe', city: 'London', account: 'SHOP-42', amount: 12.5, reference: 'T-881' });
const STALL = emvPayload({ payee: 'Market Stall', city: 'Bristol', account: 'STALL-7' });

test.describe('APP-12 Pay with a QR code in the app', { tag: ['@client', '@APP-12'] }, () => {
  test('the floating button opens the journey full screen: a photo of the code, the countdown, the confirmation, the payment', async ({ page }) => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Casey Customer', current: 1000 });
    await useSession(page, casey.session);
    await page.goto(inst.bank.url('/portal'));
    // The banking app's accent colour paints the floating button.
    await expect(page.getByTestId('client-app')).toHaveAttribute('data-accent', '');
    const fab = page.getByTestId('app-fab');
    await expect(fab).toHaveText('Pay');
    await fab.click();

    const overlay = page.getByTestId('journey-overlay');
    await expect(overlay).toHaveAttribute('data-mode', 'fullscreen');
    await expect(overlay.getByTestId('screen-title')).toHaveText('Scan to pay', { timeout: 20_000 });
    // Amount, note and category show only once a code was read.
    await expect(overlay.getByTestId('field-amount')).toHaveCount(0);
    await overlay.getByTestId('scan-photo').setInputFiles(qrImage(CAFE));
    await expect(overlay.getByTestId('scan-result')).toContainText('Pay Corner Cafe');
    await expect(overlay.getByTestId('scan-amount')).toHaveText('£12.50');
    await expect(overlay.getByTestId('field-note')).toBeVisible();
    await expect(overlay.getByTestId('field-amount')).toHaveCount(0); // the code carries its amount

    // The code has everything: the screen continues by itself after a short countdown.
    await expect(overlay.getByTestId('auto-submit')).toContainText('Continue in');
    await expect(overlay.getByTestId('screen-title')).toHaveText('Pay Corner Cafe', { timeout: 20_000 });
    await expect(overlay.getByTestId('screen-content')).toContainText('£12.50 to Corner Cafe, London');
    await overlay.getByTestId('screen-button-pay').click();
    await expect(overlay.getByTestId('journey-done-title')).toHaveText('Paid Corner Cafe', { timeout: 30_000 });
    await overlay.getByTestId('journey-finish').click();

    // Done: the overlay closes on the accounts page, with the new balance and the payment.
    await expect(overlay).toHaveCount(0);
    await expect(page).toHaveURL(/\/portal\/p\/accounts$/);
    await expect(page.locator('[data-account="cur-1"]').getByTestId('account-balance')).toHaveText('£987.50');
    await expect(page.getByTestId('transaction').filter({ hasText: 'Corner Cafe' })).toHaveCount(1);
    // The accounts page also shows the client's own code, to get paid.
    await expect(page.getByTestId('qr-code').getByTestId('qr-svg')).toHaveAttribute('data-payload', /^000201.*Casey Customer/);
  });

  test('as a sheet from the quick action: a typed code without an amount, a countdown stopped, continuing later, a link opening a dialog', async ({ page }) => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Sam Sheet', current: 500 });
    await useSession(page, casey.session);
    await page.goto(inst.bank.url('/portal'));
    await page.getByTestId('quick-action').filter({ hasText: 'Pay with QR' }).click();
    const overlay = page.getByTestId('journey-overlay');
    await expect(overlay).toHaveAttribute('data-mode', 'sheet');
    await expect(overlay).toHaveAttribute('data-side', 'bottom');

    // A code typed in, without an amount: the client says how much; nothing continues by itself.
    await overlay.getByRole('button', { name: 'Type the code instead' }).click();
    await overlay.getByTestId('scan-manual').fill(STALL);
    await overlay.getByTestId('scan-manual-use').click();
    await expect(overlay.getByTestId('scan-result')).toContainText('Pay Market Stall');
    await expect(overlay.getByTestId('currency-amount')).toHaveText('£');
    // Note and category share a row (half-width fields).
    const note = await overlay.getByTestId('field-note').boundingBox();
    const category = await overlay.getByTestId('field-category').boundingBox();
    expect(Math.abs(note!.y - category!.y)).toBeLessThan(4);
    await page.waitForTimeout(2500);
    await expect(overlay.getByTestId('auto-submit')).toHaveCount(0);
    await overlay.getByTestId('screen-button-continue').click();
    await expect(overlay.getByTestId('error-amount')).toHaveText('Required');
    await overlay.getByLabel('Amount to pay').fill('15');
    await overlay.getByTestId('screen-button-continue').click();
    await expect(overlay.getByTestId('screen-title')).toHaveText('Pay Market Stall', { timeout: 20_000 });
    await overlay.getByTestId('screen-button-back').click();

    // Back on the scanner, the code read is still there; another one, with its amount: the countdown starts, the
    // client stops it and continues when ready.
    await expect(overlay.getByTestId('screen-title')).toHaveText('Scan to pay', { timeout: 20_000 });
    await expect(overlay.getByTestId('scan-result')).toContainText('Pay Market Stall');
    await overlay.getByTestId('scan-again').click();
    await overlay.getByRole('button', { name: 'Type the code instead' }).click();
    await overlay.getByTestId('scan-manual').fill(CAFE);
    await overlay.getByTestId('scan-manual-use').click();
    await overlay.getByTestId('auto-submit-stop').click();
    await expect(overlay.getByTestId('auto-submit')).toHaveCount(0);
    await page.waitForTimeout(3000);
    await expect(overlay.getByTestId('screen-title')).toHaveText('Scan to pay', { timeout: 20_000 });
    await overlay.getByTestId('screen-button-continue').click();
    await expect(overlay.getByTestId('screen-title')).toHaveText('Pay Corner Cafe', { timeout: 20_000 });

    // Closed for now: the journey waits on the home page, and opens again as a sheet where it was.
    await overlay.getByTestId('journey-overlay-close').click();
    await expect(overlay).toHaveCount(0);
    const waiting = page.getByTestId('app-request').filter({ hasText: 'Continue: Pay with a QR code' });
    await waiting.getByRole('button', { name: 'Continue' }).click({ timeout: 30_000 });
    await expect(overlay).toHaveAttribute('data-mode', 'sheet');
    await expect(overlay.getByTestId('screen-title')).toHaveText('Pay Corner Cafe', { timeout: 20_000 });
    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);

    // A link (an e-mail, a printed code) starts the journey, here in a dialog.
    await page.goto(inst.bank.url('/portal/start/pay_qr?presentation=dialog'));
    await expect(overlay).toHaveAttribute('data-mode', 'dialog', { timeout: 30_000 });
    await expect(overlay.getByTestId('screen-title')).toHaveText('Scan to pay', { timeout: 20_000 });
    await expect(page).toHaveURL(/\/portal$/);
  });

  test('on a phone, the camera reads the code', async ({ playwright, launchOptions, headless }) => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Carla Camera', current: 300 });
    const bakery = emvPayload({ payee: 'Bakery', city: 'Leeds', account: 'BAKE-1', amount: 3.2 });
    // A browser whose camera films the code (Chromium's fake camera), watched like the others in visual mode.
    const browser = await playwright.chromium.launch({
      ...launchOptions, headless,
      args: [...(launchOptions.args ?? []), '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${fakeCameraVideo(bakery, mkdtempSync(join(tmpdir(), 'e2e-camera-')))}`],
    });
    instrumentBrowser(browser);
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ['camera'] });
      const page = await context.newPage();
      await useSession(page, casey.session);
      await page.goto(inst.bank.url('/portal'));
      await page.getByTestId('app-fab').click({ timeout: 30_000 });
      const overlay = page.getByTestId('journey-overlay');
      await expect(overlay).toHaveAttribute('data-mode', 'fullscreen', { timeout: 20_000 });
      await overlay.getByTestId('scan-camera').click();
      await expect(overlay.getByTestId('scan-result')).toContainText('Pay Bakery', { timeout: 20_000 });
      await expect(overlay.getByTestId('scan-amount')).toHaveText('£3.20');
      await expect(overlay.getByTestId('screen-title')).toHaveText('Pay Bakery', { timeout: 15_000 });
      await overlay.getByTestId('screen-button-pay').click();
      await expect(overlay.getByTestId('journey-done-title')).toHaveText('Paid Bakery', { timeout: 30_000 });
      await context.close();
    } finally {
      await browser.close();
    }
  });
});

test.describe('APP-12 Designers brand the app', { tag: ['@flow-designer', '@APP-12'] }, () => {
  test('a preset, an accent colour with a readability warning, the currency; journeys choose how they open', async ({ page }) => {
    await openAsTenantUser(page, inst.bank.key, inst.members.designer, '/app/experience');
    await expect(page.getByTestId('studio')).toBeVisible({ timeout: 30_000 });
    const preview = page.frameLocator('[data-testid=preview-frame]');
    await expect(preview.getByTestId('hero')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('studio-tab-settings').click();
    const settings = page.getByTestId('settings-inspector');
    await expect(settings).toHaveAttribute('data-setting', 'theme');
    await settings.locator('[data-preset="neo"]').click();
    await expect(preview.getByTestId('client-app')).toHaveAttribute('data-buttons', 'pill');
    await expect(preview.getByTestId('client-app')).toHaveAttribute('data-canvas', '');
    await expect(settings.getByLabel('Font')).toHaveValue('geometric');
    await expect(settings.locator('[data-check="primary-text"]')).toHaveAttribute('data-ok', 'true');

    // Every preset is readable; a mid-tone accent colour makes labels hard to read: the studio says so.
    for (const preset of ['classic', 'private', 'fresh', 'midnight', 'neo']) {
      await settings.locator(`[data-preset="${preset}"]`).click();
      await expect(settings.getByTestId('contrast').first()).toBeVisible();
      await expect(settings.locator('[data-testid=contrast][data-ok=false]')).toHaveCount(0);
    }
    await settings.getByLabel('Accent colour', { exact: true }).fill('#f472b6');
    await expect(settings.locator('[data-check="accent"]')).toHaveAttribute('data-ok', 'false');
    await settings.getByLabel('Accent colour', { exact: true }).fill('#be185d');
    await expect(settings.locator('[data-check="accent"]')).toHaveAttribute('data-ok', 'true');

    // Region: amounts in US dollars.
    await page.getByTestId('studio-setting').filter({ hasText: 'Region' }).click();
    await page.getByTestId('settings-inspector').getByLabel('Currency').selectOption('USD');
    await expect(preview.getByTestId('hero-value')).toContainText('$');

    // Journeys: how they open.
    await page.getByTestId('studio-tab-journeys').click();
    await page.locator('[data-journey="pay_qr"]').click();
    const journey = page.getByTestId('journey-inspector');
    await expect(journey.getByLabel('Opens')).toHaveValue('sheet');
    await journey.getByLabel('Opens').selectOption('fullscreen');
    await expect(page.getByTestId('app-valid')).toBeVisible();
  });
});

test.describe('APP-12 Screens with sliders, calculated values, conditional fields, one-time codes and signatures', { tag: ['@client', '@flow-designer', '@APP-12'] }, () => {
  test('the client fills a designer\'s screen in a dialog: the app checks like the API, then the answers reach the case', async ({ page }) => {
    const designer = Api.as(inst.members.designer);
    const workflowId = await publishWorkflow(designer, screenBlocksWorkflowYaml(`Screen blocks UI ${Date.now()}`));
    const draft = structuredClone((await designer.get('/client-apps/current')).body.draft);
    draft.journeys.blocks = { workflowId, title: 'Your loan', inputs: [], stages: [], hidden: true, presentation: { mode: 'dialog', size: 'lg' } };
    draft.currency = 'GBP'; // whatever the branding test left in the draft
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    expectStatus(await designer.post('/client-apps/current/publish'), 200);

    const client = await appClient(inst.bank, { name: 'Dana Dialog' });
    await useSession(page, client);
    await page.goto(inst.bank.url('/portal/start/blocks'));
    const overlay = page.getByTestId('journey-overlay');
    await expect(overlay).toHaveAttribute('data-mode', 'dialog', { timeout: 30_000 });
    await expect(overlay.getByTestId('screen-title')).toHaveText('Your loan', { timeout: 20_000 });

    // The slider starts at its minimum; the monthly payment follows it; a long term asks why.
    const slider = overlay.getByRole('slider');
    await expect(overlay.getByTestId('slider-value-months')).toHaveText('6');
    await expect(overlay.getByTestId('display-monthly')).toHaveText('£1,000.00');
    await slider.focus();
    await page.keyboard.press('End');
    await expect(overlay.getByTestId('slider-value-months')).toHaveText('60');
    await expect(overlay.getByTestId('display-monthly')).toHaveText('£100.00');
    await expect(overlay.getByTestId('field-reason')).toBeVisible();
    await page.keyboard.press('Home');
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(overlay.getByTestId('slider-value-months')).toHaveText('24');
    await expect(overlay.getByTestId('display-monthly')).toHaveText('£250.00');
    await expect(overlay.getByTestId('field-reason')).toHaveCount(0);

    // Format rules, checked in the app before anything is sent.
    await overlay.getByLabel('IBAN').fill('GB00 WEST 1234 5698 7654 32');
    await overlay.getByLabel('Reference').fill('abc');
    await overlay.getByTestId('screen-button-continue').click();
    await expect(overlay.getByTestId('error-iban')).toHaveText('Enter a valid IBAN');
    await expect(overlay.getByTestId('error-ref')).toHaveText('like ABC-123');
    await expect(overlay.getByTestId('error-code')).toHaveText('Required');
    await overlay.getByLabel('IBAN').fill('GB82 WEST 1234 5698 7654 32');
    await overlay.getByLabel('Reference').fill('ABC-123');

    // The one-time code: one box per digit.
    await overlay.getByTestId('otp-code').getByLabel('Digit 1').click();
    await page.keyboard.type('482913');
    await expect(overlay.getByTestId('otp-code').getByLabel('Digit 6')).toHaveValue('3');

    // A handwritten signature, kept as a picture through the usual upload checks.
    const pad = overlay.getByTestId('signature-pad');
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height * 0.6);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 22, box.y + box.height * (0.6 + (i % 2 ? -0.18 : 0.12)));
    await page.mouse.up();
    await overlay.getByTestId('signature-save').click();
    await expect(overlay.getByTestId('signature-signature')).toHaveAttribute('data-status', 'saved', { timeout: 30_000 });

    await overlay.getByTestId('screen-button-continue').click();
    await expect(overlay.getByTestId('journey-done')).toBeVisible({ timeout: 20_000 });
    const reference = await overlay.getByTestId('journey').getAttribute('data-case-reference');
    const kase = ((await inst.bank.adminApi.get('/cases')).body as any[]).find((c) => c.reference === reference);
    const data = (await Api.as(inst.bank.admin).get(`/cases/${kase.id}`)).body.data;
    expect(data).toMatchObject({ months: 24, iban: 'GB82 WEST 1234 5698 7654 32', ref: 'ABC-123', code: '482913', signature: [expect.objectContaining({ name: 'signature.png', contentType: 'image/png' })] });
    expect(data.monthly).toBeUndefined();
  });
});
