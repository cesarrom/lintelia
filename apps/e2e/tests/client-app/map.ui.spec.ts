import { test, expect, type Page } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { openAsTenantUser } from '../../support/ui';
import { installBankingApp } from '../../support/client-app';

/**
 * APP-11 The experience map (docs/plans/13): the app's layout and pages, the journeys with the screens their workflows
 * show, the workflows and forms behind them — on one canvas; links inside the frames follow their arrows; every
 * frame opens its editor, which leads back to the map.
 */
test.describe.configure({ timeout: 180_000 });

let inst: Institution;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  await installBankingApp(Api.as(inst.members.designer));
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const node = (page: Page, id: string) => page.locator(`[data-map-node="${id}"]`);
const inspectorTitle = (page: Page) => page.getByTestId('map-inspector-title');

test.describe('APP-11 See and navigate everything on the map', { tag: ['@flow-designer', '@APP-11'] }, () => {
  test('the API draws the app, its journeys and workflows; clients cannot read it', async () => {
    const map = await Api.as(inst.members.designer).get('/experience-map');
    expectStatus(map, 200);
    expect(Object.keys(map.body.app.definition.pages)).toContain('accounts');
    const transfer = (map.body.workflows as any[]).find((w) => w.name === 'App: move money');
    expect(transfer.touchpoints.map((t: any) => t.stepId)).toEqual(['form', 'problem', 'confirm']);
    expect(transfer.flow.find((f: any) => f.from === 'confirm' && f.event === 'move')).toMatchObject({ to: '@end:completed:transferred' });
    const welcome = (map.body.workflows as any[]).find((w) => w.name === 'App: welcome new clients');
    expect(welcome.startOn).toEqual(['client.registered']);
    const client = await Api.anonymous(inst.bank.key).post('/auth/register', { email: `map.${Date.now()}@customers.example`, password: 'e2e-Password-1234', name: 'Map Client', consents: [{ key: 'terms', version: '2026-01' }, { key: 'privacy', version: '2026-01' }] });
    expectStatus(await Api.as(client.body).get('/experience-map'), [401, 403]);
  });

  test('frames, arrows, following links, personas, layers, and the way to each editor and back', async ({ page }) => {
    await openAsTenantUser(page, inst.bank.key, inst.members.designer, '/app/map');
    const map = page.getByTestId('experience-map');
    await expect(map).toHaveAttribute('data-settled', 'true', { timeout: 60_000 });

    // The layout once (its menu), the pages drawn with their widgets, a journey per row with its screens.
    await expect(node(page, 'layout')).toContainText('Accounts');
    await expect(node(page, 'page:home').getByTestId('hero')).toBeVisible();
    await expect(page.locator('[data-map-node^="page:"]')).toHaveCount(9);
    await expect(page.locator('[data-map-node^="journey:"]')).toHaveCount(9);
    await expect(node(page, 'j:transfer:tp:form')).toContainText('Move money between your accounts');
    await expect(node(page, 'j:open_current:tp:identity')).toContainText('Upload');
    // Screens show their scanner, conditional fields and whether they continue by themselves (docs/plans/14).
    await expect(node(page, 'j:pay_qr:tp:scan')).toContainText('Scan with the camera');
    await expect(node(page, 'j:pay_qr:tp:scan')).toContainText('Continues by itself (continue) when its rule holds after 2 s');

    // A button inside a frame follows its arrow: "Move money" on the home page → the journey.
    await node(page, 'page:home').getByTestId('quick-action').filter({ hasText: 'Move money' }).click();
    await expect(inspectorTitle(page)).toHaveText('Move money');
    await expect(page.getByTestId('map-inspector').getByTestId('map-link').filter({ hasText: 'Transfer details' })).toBeVisible();
    // A screen's button follows the journey: "Review transfer" → the check → confirm / "not possible".
    await page.getByTestId('map-inspector').getByTestId('map-link').filter({ hasText: 'Transfer details' }).click();
    await expect(inspectorTitle(page)).toHaveText('Transfer details');
    await expect(page.getByTestId('map-back')).toBeVisible();

    // Personas: what a customer sees and what a newcomer sees.
    const onboard = node(page, 'page:home').locator('[data-widget-id="home-onboard"]');
    const actions = node(page, 'page:home').locator('[data-widget-id="home-actions"]');
    await expect(onboard).not.toHaveClass(/opacity-40/);
    await expect(actions).toHaveClass(/opacity-40/);
    await page.getByTestId('map-persona').selectOption('customer');
    await expect(onboard).toHaveClass(/opacity-40/);
    await expect(actions).not.toHaveClass(/opacity-40/);

    // Layers: the journey screens can be hidden.
    await page.getByRole('button', { name: 'Layers' }).click();
    await page.getByTestId('map-layer-journeys').uncheck();
    await expect(node(page, 'j:transfer:tp:form')).toHaveCount(0);
    await page.getByTestId('map-layer-journeys').check();
    await page.keyboard.press('Escape');
    await expect(node(page, 'j:transfer:tp:form')).toBeVisible();

    // A page opens in the studio, with the way back.
    await page.getByTestId('map-search').fill('Accounts');
    await page.getByTestId('map-search-result').filter({ hasText: 'page' }).first().click();
    await expect(inspectorTitle(page)).toHaveText('Accounts');
    await page.getByTestId('map-open').click();
    await expect(page).toHaveURL(/\/app\/experience\?page=accounts&from=map$/);
    await expect(page.getByTestId('page-inspector').getByLabel('Key')).toHaveValue('accounts', { timeout: 30_000 });
    await page.getByTestId('back-to-map').click();
    await expect(map).toHaveAttribute('data-settled', 'true', { timeout: 60_000 });

    // A journey opens on the journeys tab.
    await page.getByTestId('map-search').fill('Report a lost');
    await page.getByTestId('map-search-result').first().click();
    await page.getByTestId('map-open').click();
    await expect(page.getByTestId('journey-inspector')).toContainText('Report a lost or stolen card', { timeout: 30_000 });
    await expect(page.locator('[data-testid=studio-journey][data-journey=report_lost]')).toHaveClass(/bg-primary-soft/);
    await page.getByTestId('back-to-map').click();

    // A screen opens its step in the workflow editor, its configuration open.
    await expect(map).toHaveAttribute('data-settled', 'true', { timeout: 60_000 });
    await page.getByTestId('map-search').fill('Transfer details');
    await page.getByTestId('map-search-result').first().click();
    await page.getByTestId('map-open').click();
    await expect(page).toHaveURL(/\/app\/workflows\/[0-9a-f-]+\?from=map&step=form$/);
    await expect(page.getByRole('dialog').getByLabel('Step name')).toHaveValue('Transfer details', { timeout: 30_000 });
    await page.keyboard.press('Escape');
    await page.getByTestId('back-to-map').click();
    await expect(page).toHaveURL(/\/app\/map$/);
  });
});
