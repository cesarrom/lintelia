import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { openAsTenantUser, useSession } from '../../support/ui';
import { bankingCustomer, installBankingApp, systemApi } from '../../support/client-app';
import { publishWorkflow } from '../../support/workflows';

/**
 * Screens that update by themselves, in the browser (docs/plans/17): with the live stream up, pages poll only every
 * minute or two, so what follows can only happen through live updates. The balance of the banking app moves when the
 * core banking system writes it and notifications pop up (LIVE-01); the team's task list fills as cases arrive and a
 * workflow's message to a role pops up (LIVE-02); a journey shows the progress its workflow publishes, from the start
 * (LIVE-03).
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

let inst: Institution;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  await installBankingApp(Api.as(inst.members.designer));
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const decision = (id: string, status = 'completed') => `  - { id: ${id}, name: ${id}, type: case.decision, config: { status: ${status}, notifyApplicant: false }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }`;
const connected = async (page: import('@playwright/test').Page) => expect(page.locator('html')).toHaveAttribute('data-live', 'connected', { timeout: 15_000 });

test.describe('LIVE-01 The banking app follows the bank\'s systems', { tag: ['@client', '@LIVE-01'] }, () => {
  test('the balance changes on screen when the core banking system writes it; a notification pops up', async ({ page }) => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Casey Customer', current: 1500, savings: 0 });
    await useSession(page, casey.session);
    await page.goto(inst.bank.url('/portal'));
    await expect(page.getByTestId('hero-value')).toHaveText('£1,500.00');
    await connected(page);

    expectStatus(await system.put(`/clients/ext:${casey.externalId}/records/accounts/cur-1`, { data: { name: 'Everyday account', type: 'current', number: '•• 1111', balance: 1750.25, currency: 'GBP', status: 'active' } }), 200);
    await expect(page.getByTestId('hero-value')).toHaveText('£1,750.25', { timeout: 8_000 });

    const notify = await publishWorkflow(inst.bank.adminApi, `schemaVersion: "1"
name: "Salary arrived"
description: tells the client
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [hello] }] }
  - { id: hello, name: Tell, type: client.notify, config: { title: Your salary arrived, body: "£3,240.00 from Northwind Ltd", tone: success }, events: [{ name: done, outputs: [], next: [done] }] }
${decision('done')}
`);
    expectStatus(await inst.bank.adminApi.post(`/workflows/${notify}/executions`, { inputs: { email: casey.email, fullName: 'Casey Customer' } }), 202);
    await expect(page.getByText('Your salary arrived')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('LIVE-02 The team\'s lists fill as cases arrive', { tag: ['@reviewer', '@LIVE-02'] }, () => {
  test('a new review appears in the queue without reloading; a workflow\'s message to reviewers pops up', async ({ page }) => {
    const workflowId = await publishWorkflow(inst.bank.adminApi, `schemaVersion: "1"
name: "Live review"
description: a review, then a message to the reviewers
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [tell] }] }
  - { id: tell, name: Tell reviewers, type: live.publish, config: { to: role, role: reviewer, payload: { title: "= 'New review: ' & case.reference", tone: info } }, events: [{ name: done, outputs: [], next: [review] }, { name: failed, outputs: [], next: [review] }] }
  - { id: review, name: Review, type: review, config: { title: "Live review {{case.reference}}", assignTo: { role: reviewer } }, events: [{ name: review_approved, outputs: [], next: [done] }, { name: review_rejected, outputs: [], next: [done] }] }
${decision('done')}
`);
    await openAsTenantUser(page, inst.bank.key, inst.members.analyst, '/app/tasks');
    await page.getByRole('tab', { name: /Team queue/ }).click();
    await connected(page);
    const started = await inst.bank.adminApi.post('/cases', { workflowId, inputs: {} });
    expectStatus(started, 201);
    await expect(page.getByText(`New review: ${started.body.reference}`)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(`Live review ${started.body.reference}`)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('LIVE-03 A journey shows what its workflow is doing', { tag: ['@client', '@LIVE-03'] }, () => {
  test('progress messages appear one after the other, including those sent before the screen listened', async ({ page }) => {
    const designer = Api.as(inst.members.designer);
    const workflowId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Checks with progress"
description: tells the client what it checks
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [id] }] }
  - { id: id, name: Identity, type: live.publish, config: { to: case, channel: progress, payload: { text: Checking your identity… } }, events: [{ name: done, outputs: [], next: [pause1] }] }
  - { id: pause1, name: Pause, type: wait, config: { duration: PT8S }, events: [{ name: done, outputs: [], next: [address] }] }
  - { id: address, name: Address, type: live.publish, config: { to: case, channel: progress, payload: { text: Checking your address… } }, events: [{ name: done, outputs: [], next: [pause2] }] }
  - { id: pause2, name: Pause, type: wait, config: { duration: PT10S }, events: [{ name: done, outputs: [], next: [done] }] }
${decision('done')}
`);
    const app = (await designer.get('/client-apps/current')).body;
    const draft = { ...app.draft, journeys: { ...app.draft.journeys, checks: { workflowId, title: 'Quick checks', inputs: [], stages: [], hidden: true } } };
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    expectStatus(await designer.post('/client-apps/current/publish'), 200);

    const casey = await bankingCustomer(inst.bank, system, { name: 'Casey Customer' });
    const started = await Api.as(casey.session).post('/me/app/journeys/checks/start', { input: {} });
    expectStatus(started, [200, 201]);
    expect(started.body.live.topics).toContain(`case/${started.body.case.id}/channel/*`);
    await useSession(page, casey.session);
    await page.goto(inst.bank.url(`/portal/journeys/${started.body.case.id}`));
    await expect(page.getByTestId('journey-progress')).toHaveText('Checking your address…', { timeout: 15_000 });
    // Sent before the page listened: replayed, in order.
    await expect(page.getByTestId('journey-progress-history')).toContainText('Checking your identity…');
    await expect(page.getByTestId('journey-done')).toBeVisible({ timeout: 25_000 });
  });
});

