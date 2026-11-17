import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { requireFake } from '../../support/fakes';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { personaPage } from '../../support/ui';

test.describe.configure({ timeout: 120_000 });

let inst: Institution;
test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { integrator: 'integration_manager' } });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('FIA-10 API clients and webhooks from the back office', { tag: ['@integration-manager', '@FIA-10', '@WH-01'] }, () => {
  test('create an API client (secret shown once, works for tokens) and a webhook (test event delivered)', async ({ browser }) => {
    const page = await personaPage(browser, inst.bank.key, inst.members.integrator, '/app/keys');
    await page.getByRole('button', { name: 'New API client' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Core banking sync');
    await dialog.getByRole('checkbox', { name: 'View workflows' }).click();
    await dialog.getByRole('button', { name: 'Create' }).click();
    const clientId = await page.getByTestId('client-id').inputValue();
    const clientSecret = await page.getByTestId('client-secret').inputValue();
    expect(clientSecret).toMatch(/^fcs_/);
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('api-client-row').filter({ hasText: 'Core banking sync' })).toContainText('workflows:read');
    await expect(page.getByText(clientSecret)).toHaveCount(0);
    const token = await Api.anonymous().post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }));
    expectStatus(token, 200);

    const receiver = await requireFake('webhookReceiver');
    await page.goto(inst.bank.url('/app/webhooks'));
    await page.getByRole('button', { name: 'New webhook' }).click();
    const hook = page.getByRole('dialog');
    await hook.getByLabel('Endpoint URL').fill(`${receiver}/hooks/ui-${inst.bank.key}`);
    await hook.getByRole('checkbox', { name: 'case.decided' }).click();
    await hook.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByTestId('webhook-secret')).toHaveValue(/^whsec_/);
    await page.getByRole('button', { name: 'Done' }).click();
    const row = page.getByTestId('webhook-row').first();
    await row.getByRole('button', { name: 'Test' }).click();
    await row.getByRole('button', { name: 'Show deliveries' }).click();
    await expect(page.getByTestId('delivery-row').first()).toHaveAttribute('data-status', 'delivered', { timeout: 20_000 });
  });
});
