import { test, expect } from '../../support/test';
import { Api } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { openAsTenantUser, useSession } from '../../support/ui';
import { appClient } from '../../support/client-app';

/**
 * APP-01 The studio: a designer starts from the banking template, edits a page with widgets while watching the live
 * preview (computer and phone), fixes what validation reports and publishes; clients see the change.
 */
test.describe.configure({ timeout: 180_000 });

let inst: Institution;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('APP-01 Build the client app in the studio', { tag: ['@flow-designer', '@APP-01', '@APP-02'] }, () => {
  test('template, widgets with a live preview, validation, publication', async ({ page, browser }) => {
    await openAsTenantUser(page, inst.bank.key, inst.members.designer, '/app/experience');
    await expect(page.getByTestId('studio')).toBeVisible();
    const preview = page.frameLocator('[data-testid=preview-frame]');

    // Start from the banking template (it also creates the journey workflows).
    await page.getByTestId('open-templates').click();
    await page.locator('[data-template="banking"]').getByRole('button', { name: 'Use this template' }).click();
    await expect(page.getByText('Template loaded into the draft')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('studio-page')).toHaveCount(9);
    await expect(preview.getByTestId('hero')).toContainText('Welcome back, Alex');
    await expect(page.getByTestId('app-valid')).toBeVisible();

    // Add a callout to the home page and write it in the inspector; the preview follows.
    await page.getByTestId('add-widget').click();
    await page.getByTestId('widget-palette').getByPlaceholder('Search widgets').fill('callout');
    await page.getByTestId('palette-item').filter({ hasText: 'Callout' }).click();
    const inspector = page.getByTestId('widget-inspector');
    await expect(inspector).toHaveAttribute('data-type', 'callout');
    await inspector.getByLabel('Title').fill('Summer savings boost');
    await inspector.getByLabel('Text').fill('**4.5% AER** on new savings until August.');
    await inspector.getByLabel('Tone').selectOption('brand');
    await inspector.getByLabel('Journey', { exact: true }).selectOption('open_savings');
    await inspector.getByLabel('Button label').fill('Open one');
    const callout = preview.getByTestId('callout').filter({ hasText: 'Summer savings boost' });
    await expect(callout).toContainText('4.5% AER on new savings until August.');
    await expect(callout.getByRole('button', { name: 'Open one' })).toBeVisible();

    // Move it to the top; selecting in the preview selects in the outline.
    // (Moving up passes through the two-column section before the end of the page.)
    const row = page.getByTestId('outline-widget').filter({ hasText: 'Summer savings boost' });
    for (let i = 0; i < 12 && !(await page.getByTestId('outline-widget').first().textContent())?.includes('Summer'); i++) {
      await row.getByRole('button', { name: 'Move up' }).click();
    }
    await expect(page.getByTestId('outline-widget').first()).toContainText('Summer savings boost');
    await expect(preview.locator('[data-widget-id]').first()).toContainText('Summer savings boost');
    await preview.getByTestId('hero').click();
    await expect(inspector).toHaveAttribute('data-type', 'hero');

    // On a phone.
    await page.getByTestId('device-phone').click();
    await expect(preview.getByTestId('app-tab')).toHaveCount(4);

    // A broken rule is reported and blocks publishing, until it is fixed.
    await inspector.getByLabel('Show only when').fill("not('customer' in me.segments)");
    await expect(page.getByTestId('app-problems')).toBeVisible();
    await expect(page.getByTestId('publish-app')).toBeDisabled();
    await page.getByTestId('app-problems').click();
    await expect(page.getByTestId('problems-list')).toContainText('use $not(…)');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('problems-list')).toBeHidden();
    await inspector.getByLabel('Show only when').fill('');
    await expect(page.getByTestId('app-valid')).toBeVisible();
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');

    await page.getByTestId('publish-app').click();
    await expect(page.getByText('Published version 1')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('versions')).toHaveText(/Live: v1/);

    // Clients get it.
    const client = await appClient(inst.bank, { name: 'Sunny Saver' });
    const context = await browser.newContext();
    const clientPage = await context.newPage();
    await useSession(clientPage, client);
    await clientPage.goto(inst.bank.url('/portal'));
    await expect(clientPage.getByTestId('callout').first()).toContainText('Summer savings boost');
    await context.close();
  });

  test('a page of its own, in the menu', async ({ page }) => {
    // The app exists (previous test, or installed now when this test runs alone).
    const designer = Api.as(inst.members.designer);
    const current = await designer.get('/client-apps/current');
    if (!current.body.activeVersion) {
      await designer.post('/client-apps/current/template', { template: 'banking' });
      await designer.post('/client-apps/current/publish');
    }
    await openAsTenantUser(page, inst.bank.key, inst.members.designer, '/app/experience');
    // The studio is a large page: the first visit after a start may wait for the dev server to build it.
    await expect(page.getByTestId('studio')).toBeVisible({ timeout: 30_000 });
    const preview = page.frameLocator('[data-testid=preview-frame]');
    await page.getByTestId('add-page').click();
    await page.getByRole('dialog').getByLabel('Title').fill('Rewards');
    await page.getByRole('dialog').getByRole('button', { name: 'Add' }).click();
    await expect(page.getByTestId('page-inspector')).toBeVisible();
    await page.getByTestId('page-in-menu').click();
    await page.getByLabel('Icon').fill('gift');
    await page.getByTestId('add-widget').click();
    await page.locator('[data-testid=palette-item][data-type=stat]').click();
    const inspector = page.getByTestId('widget-inspector');
    await inspector.getByLabel('Label').fill('Points');
    await inspector.getByLabel('Value').fill('= $count(records.transactions) * 10');
    await expect(preview.getByTestId('app-page-title')).toHaveText('Rewards');
    await expect(preview.getByTestId('stat-value')).not.toHaveText('—');
    await expect(preview.getByTestId('app-nav').filter({ hasText: 'Rewards' })).toBeVisible();
  });
});
