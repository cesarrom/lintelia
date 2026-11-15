import { test, expect, type Browser } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { Api, expectStatus } from '../../support/api';
import { addClient, deleteTenant, DEFAULT_PASSWORD, login } from '../../support/factories';
import { waitForEmail } from '../../support/mailbox';
import { prepareInstitution, type Institution, type Member } from '../../support/scenario';
import { personaPage, signInThroughForm } from '../../support/ui';
import { minimalWorkflowYaml, publishWorkflow } from '../../support/workflows';

// Multi-persona journey: several browser contexts, slower when the whole suite runs in parallel.
test.describe.configure({ timeout: 120_000 });

let inst: Institution;
test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { mlro: 'compliance_officer' } });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

async function portalAs(browser: Browser, client: Member) {
  const page = await (await browser.newContext()).newPage();
  await signInThroughForm(page, inst.bank.url('/sign-on'), client.email, DEFAULT_PASSWORD);
  await expect(page).toHaveURL(/\/portal/);
  await page.getByRole('link', { name: 'Privacy' }).click();
  return page;
}

async function completeAsCompliance(browser: Browser, email: string, action: 'Prepare export' | 'Process erasure', toast: string | RegExp) {
  const mlro = await personaPage(browser, inst.bank.key, inst.members.mlro, '/app/data-requests');
  const row = mlro.getByTestId('data-request-row').filter({ hasText: email }).filter({ hasText: action === 'Prepare export' ? 'Copy of data' : 'Erasure' });
  await row.getByRole('button', { name: action }).click();
  await expect(mlro.getByText(toast)).toBeVisible();
}

test.describe('CLI-10 / CMP-03 Data-rights requests', { tag: ['@client', '@CLI-10', '@compliance', '@CMP-03'] }, () => {
  test('a client asks for a copy of their data; compliance prepares it; the client downloads it', async ({ browser }) => {
    const client = await addClient(inst.bank, { name: 'Dana Data' });
    const portal = await portalAs(browser, client);
    await portal.getByRole('button', { name: 'Request a copy of my data' }).click();
    const card = portal.getByTestId('data-request').filter({ hasText: 'Copy of my data' });
    await expect(card).toContainText('In progress');

    const since = Date.now() - 1000;
    await completeAsCompliance(browser, client.email, 'Prepare export', 'Request completed — the client was notified');
    await waitForEmail({ tenant: inst.bank.key, to: client.email, subject: 'Your data export is ready', since });

    await expect(card).toContainText('Done', { timeout: 10_000 });
    const [download] = await Promise.all([portal.waitForEvent('download'), card.getByRole('button', { name: 'Download' }).click()]);
    const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(exported.profile).toMatchObject({ email: client.email, name: 'Dana Data' });
  });

  test('erasure is declined, neutrally, while an application is open; granted otherwise', async ({ browser }) => {
    // Open application: records must be kept.
    const busy = await addClient(inst.bank, { name: 'Olga Open' });
    const workflowId = await publishWorkflow(inst.bank.adminApi, minimalWorkflowYaml(`Retention ${Date.now()}`));
    expectStatus(await inst.bank.adminApi.post('/cases', { workflowId, client: { email: busy.email, name: 'Olga Open' }, inputs: {} }), 201);
    const busyPortal = await portalAs(browser, busy);
    busyPortal.once('dialog', (d) => d.accept());
    await busyPortal.getByRole('button', { name: 'Erase my data' }).click();
    await completeAsCompliance(browser, busy.email, 'Process erasure', /Erasure declined/);
    const declined = busyPortal.getByTestId('data-request').filter({ hasText: 'Erasure of my data' });
    await expect(declined).toContainText('Declined', { timeout: 10_000 });
    await expect(declined).toContainText('must be kept for legal reasons');

    // No open business: the profile is erased and the account closed.
    const done = await addClient(inst.bank, { name: 'Erin Erase' });
    const portal = await portalAs(browser, done);
    portal.once('dialog', (d) => d.accept());
    await portal.getByRole('button', { name: 'Erase my data' }).click();
    await completeAsCompliance(browser, done.email, 'Process erasure', 'Request completed — the client was notified');
    expect((await login(inst.bank.key, done.email)).status).toBe(401);
    const clients = await Api.as(inst.members.mlro).get(`/clients?search=${encodeURIComponent(done.email)}`);
    expect(clients.body).toHaveLength(0);
  });
});
