import { test, expect } from '@playwright/test';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { requireConnector } from '../../support/connectors';
import { personaPage } from '../../support/ui';

test.describe.configure({ timeout: 120_000 });

let inst: Institution;

test.beforeAll(async () => {
  await requireConnector('smtp-mailer');
  inst = await prepareInstitution({ members: { integrator: 'integration_manager' } });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('CON-01 Connect a connector from the Integrations page', { tag: ['@integration-manager', '@CON-01', '@INT-04'] }, () => {
  test("consent, the connector's own page, back to an active connection, then settings in place", async ({ browser }) => {
    const page = await personaPage(browser, inst.bank.key, inst.members.integrator, '/app/integrations');
    const card = page.getByTestId('connector-card').filter({ has: page.getByText('SMTP mailer', { exact: true }) });
    await card.getByRole('button', { name: 'Connect' }).click();

    // Consent: what the connector will be able to do.
    const consent = page.getByRole('dialog');
    await expect(consent.getByTestId('connector-scopes')).toContainText('Write results to cases');
    await consent.getByRole('button', { name: 'Continue to SMTP mailer' }).click();

    // The connector's page (its own origin), branded for the institution.
    await page.waitForURL(/localhost:4101\/connect/);
    await expect(page.getByText(`Connecting for ${inst.bank.tenant.name}`)).toBeVisible();
    await page.getByLabel('SMTP host').fill('localhost');
    await page.getByLabel('Port', { exact: true }).fill('1025');
    await page.getByLabel('Username').fill('bank-mailer');
    await page.getByLabel('Password').fill('wrong');
    await page.getByLabel('From address').fill(`no-reply@${inst.bank.key}.example`);
    await page.getByRole('button', { name: 'Test and connect' }).click();
    await expect(page.getByRole('alert')).toContainText('Invalid username or password');
    await page.getByLabel('Password').fill('correct-horse');
    await page.getByRole('button', { name: 'Test and connect' }).click();

    // Back in the back office: the connection is active with its (non-secret) summary.
    await page.waitForURL(/\/app\/integrations/, { timeout: 15_000 });
    const row = page.getByTestId('connection-row').filter({ hasText: `no-reply@${inst.bank.key}.example` });
    await expect(row).toHaveAttribute('data-status', 'active');
    await expect(row).toContainText('localhost:1025');

    // Settings open the connector's page inside the back office; saving closes it.
    await row.getByRole('button', { name: 'Settings' }).click();
    const frame = page.frameLocator('iframe[title="SMTP mailer settings (connector page)"]');
    await expect(frame.getByLabel('Password')).toHaveAttribute('placeholder', 'Unchanged');
    await frame.getByLabel('From name').fill('E2E Bank');
    await frame.getByRole('button', { name: 'Test and save' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    await expect(row).toContainText('E2E Bank');
  });
});
