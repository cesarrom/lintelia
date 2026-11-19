import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { addClient, addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { waitForTask, decide } from '../../support/scenario';
import { openAsTenantUser, personaPage } from '../../support/ui';

/**
 * The institution's own back office in the browser (docs/plans/16), with the "Fee waivers" template: the studio's
 * back-office mode (BOA-01, BOA-05), the menu item, client tab and button only for holders of "Waive fees" (BOA-02),
 * the action's staff screen in a dialog, left half-way and resumed (BOA-03), homes (BOA-06), the dashboard addition.
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

let bank: TenantHandle;
let designer: Awaited<ReturnType<typeof addMember>>;
let rm: Awaited<ReturnType<typeof addMember>>;
let reviewer: Awaited<ReturnType<typeof addMember>>;
let lead: Awaited<ReturnType<typeof addMember>>;
let client: Awaited<ReturnType<typeof addClient>>;

test.beforeAll(async () => {
  bank = await createTenant();
  designer = await addMember(bank, { roles: ['flow_designer'], label: 'designer' });
  rm = await addMember(bank, { roles: ['relationship_manager'], label: 'rm' });
  reviewer = await addMember(bank, { roles: ['reviewer'], label: 'reviewer' });
  lead = await addMember(bank, { roles: ['senior_reviewer'], label: 'lead' });
  client = await addClient(bank, { name: 'Casey Customer' });
  expectStatus(await bank.adminApi.put(`/clients/${client.user.userId}/records/accounts`, {
    records: [{ key: 'cur-1', data: { name: 'Everyday account', type: 'current', number: '•• 1111', balance: 100, currency: 'GBP', status: 'active' } }],
  }), 200);
  expectStatus(await bank.adminApi.put('/member-attributes', { attributes: [{ key: 'authorityLimit', label: 'Authority limit (fee waivers)', type: 'number' }] }), 200);
  expectStatus(await bank.adminApi.patch(`/users/${rm.user.userId}/attributes`, { authorityLimit: 50 }), 200);
});
test.afterAll(async () => { await deleteTenant(bank); });

const balance = async () => ((await bank.adminApi.get(`/clients/${client.user.userId}/records/accounts`)).body as Array<{ key: string; balance: number }>).find((r) => r.key === 'cur-1')?.balance;

test.describe('BOA-01 A designer builds the back office in the studio', { tag: ['@flow-designer', '@BOA-01'] }, () => {
  test('from the Fee waivers template: next steps, the workflow approved by an administrator, then published', async ({ page }) => {
    await openAsTenantUser(page, bank.key, designer, '/app/back-office');
    await expect(page.getByTestId('bo-studio')).toBeVisible();
    // Designers of both get the switch between the client app and the back office.
    await expect(page.getByTestId('studio-mode').getByRole('link', { name: 'Client app' })).toBeVisible();
    await page.getByTestId('open-templates').click();
    await page.getByTestId('bo-template').filter({ hasText: 'Fee waivers' }).getByRole('button', { name: 'Use this template' }).click();
    await expect(page.getByTestId('template-next-steps')).toContainText('an administrator approves its publication');
    await page.getByRole('button', { name: 'Got it' }).click();

    // The draft has the desk, the client tab, the button and the dashboard widget; the workflow is not published yet.
    await expect(page.getByTestId('bo-page')).toHaveCount(2);
    await expect(page.getByTestId('bo-slot').filter({ hasText: 'Client page' })).toContainText('1 button · 1 tab');
    await expect(page.getByTestId('app-problems')).toBeVisible();
    await expect(page.getByTestId('publish-back-office')).toBeDisabled();

    const pending = ((await bank.adminApi.get('/access-changes?status=pending_approval')).body as Array<{ id: string; kind: string }>).find((c) => c.kind === 'workflow.publish')!;
    expectStatus(await bank.adminApi.post(`/access-changes/${pending.id}/approve`), 200);
    await page.reload();
    await expect(page.getByTestId('app-valid')).toBeVisible();
    await page.getByTestId('publish-back-office').click();
    await expect(page.getByText('Published version 1')).toBeVisible();
  });

  test('a widget selected on the canvas is edited in the inspector; the draft saves itself', async ({ page }) => {
    await openAsTenantUser(page, bank.key, designer, '/app/back-office');
    await page.getByTestId('bo-page').filter({ hasText: 'Servicing desk' }).click();
    await page.getByTestId('bo-canvas').locator('[data-select-id="how"]').click();
    const inspector = page.getByTestId('widget-inspector');
    await expect(inspector).toHaveAttribute('data-type', 'callout');
    await inspector.getByLabel('Title', { exact: true }).fill('How to waive a fee');
    await expect(page.getByTestId('bo-canvas')).toContainText('How to waive a fee');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
    const draft = (await Api.as(designer).get('/backoffice/current')).body.draft;
    expect(draft.pages.servicing.widgets.find((w: { id: string }) => w.id === 'how').props.title).toBe('How to waive a fee');
  });
});

test.describe('BOA-05 Who gets what, before publishing', { tag: ['@flow-designer', '@BOA-05'] }, () => {
  test('the access report per role, and the canvas as a role', async ({ page }) => {
    for (const role of ['relationship_manager', 'senior_reviewer']) expectStatus(await bank.adminApi.put(`/roles/${role}`, { customPermissions: ['custom:fees.waive'] }), 200);
    await openAsTenantUser(page, bank.key, designer, '/app/back-office');
    await page.getByTestId('open-access-report').click();
    const report = page.getByTestId('access-report');
    await expect(report.locator('[data-role="relationship_manager"]')).toContainText('Servicing desk');
    await expect(report.locator('[data-role="relationship_manager"]')).toContainText('Servicing tab');
    await expect(report.locator('[data-role="reviewer"]')).not.toContainText('Servicing');
    await page.keyboard.press('Escape');

    await page.getByTestId('bo-page').filter({ hasText: 'Servicing desk' }).click();
    await page.getByTestId('bo-preview-as').selectOption('reviewer');
    await expect(page.getByTestId('bo-preview-missing')).toContainText('Members with this role do not get this page');
    await page.getByTestId('bo-preview-as').selectOption('relationship_manager');
    await expect(page.getByTestId('bo-canvas')).toContainText('Recent fee waivers');
    // "My tasks" is for members who work tasks: relationship managers do not get it.
    await expect(page.getByTestId('bo-canvas').locator('[data-select-id="my-tasks"]')).toHaveCount(0);
  });
});

test.describe('BOA-02 Only holders of "Waive fees" get the desk, the tab and the button', { tag: ['@relationship-manager', '@BOA-02'] }, () => {
  test('a relationship manager gets them; a reviewer gets none of them', async ({ page, browser }) => {
    await openAsTenantUser(page, bank.key, rm, '/app/dashboard');
    await expect(page.getByTestId('dashboard-slot')).toContainText('Fee waivers waiting for approval');
    await page.getByRole('link', { name: 'Servicing desk' }).click();
    await expect(page).toHaveURL(/\/app\/x\/servicing/);
    await expect(page.getByRole('heading', { name: 'Servicing desk' })).toBeVisible();

    const other = await personaPage(browser, bank.key, reviewer, `/app/clients/${client.user.userId}`);
    await expect(other.getByRole('heading', { name: 'Casey Customer' }).first()).toBeVisible();
    await expect(other.getByRole('link', { name: 'Servicing desk' })).toHaveCount(0);
    await expect(other.getByTestId('slot-action')).toHaveCount(0);
    await expect(other.getByTestId('slot-tabs')).toHaveCount(0);
    await other.goto(other.url().replace(/\/app\/clients\/.*/, '/app/x/servicing'));
    await expect(other.getByText('This page does not exist, or it is not for you.')).toBeVisible();
    await other.context().close();
  });
});

test.describe('BOA-03 The action on the client page', { tag: ['@relationship-manager', '@BOA-03'] }, () => {
  test('within the authority limit: the screen in a dialog, the fee refunded, the client tab shows it', async ({ page }) => {
    await openAsTenantUser(page, bank.key, rm, `/app/clients/${client.user.userId}`);
    await page.getByTestId('slot-action').filter({ hasText: 'Waive a fee' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Waive a fee for Casey Customer');
    await dialog.getByLabel('Refund to').selectOption('cur-1');
    await dialog.getByRole('radio', { name: 'Late payment' }).click();
    await dialog.getByLabel('Amount').fill('20');
    await dialog.getByLabel('Why').fill('First late payment in years');
    await dialog.getByRole('button', { name: 'Waive the fee' }).click();
    await expect(dialog.getByTestId('action-outcome')).toContainText('Done');
    await dialog.getByTestId('action-outcome').getByRole('button', { name: 'Close' }).click();
    await expect.poll(balance, { timeout: 15_000 }).toBe(120);

    await page.getByRole('tab', { name: 'Servicing' }).click();
    const tab = page.getByTestId('back-office-widgets');
    await expect(tab).toContainText('Fee refund · Late payment', { timeout: 30_000 });
  });

  test('above it: sent for approval; a screen left half-way waits on the dashboard and is resumed', async ({ page }) => {
    await openAsTenantUser(page, bank.key, rm, `/app/clients/${client.user.userId}`);
    await page.getByTestId('slot-action').filter({ hasText: 'Waive a fee' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Refund to').selectOption('cur-1');
    await dialog.getByRole('radio', { name: 'Overdraft fee' }).click();
    await dialog.getByLabel('Amount').fill('80');
    await dialog.getByLabel('Why').fill('Bank error');
    await dialog.getByRole('button', { name: 'Waive the fee' }).click();
    await expect(dialog.getByTestId('action-outcome')).toContainText('Waiting for: Approve a fee waiver');
    await dialog.getByTestId('action-outcome').getByRole('button', { name: 'Close' }).click();
    const inReview = async () => ((await bank.adminApi.get('/cases')).body as Array<{ id: string; status: string; workflow: { name: string } }>).find((c) => c.workflow.name === 'Fee waiver' && c.status === 'in_review');
    await expect.poll(async () => !!(await inReview()), { timeout: 15_000 }).toBe(true);
    const approval = await waitForTask(Api.as(lead), (await inReview())!.id, { view: 'queue' });
    expectStatus(await Api.as(lead).post(`/tasks/${approval.id}/claim`), 200);
    expectStatus(await decide(Api.as(lead), approval.id, 'approve', 'agreed'), 200);
    await expect.poll(balance, { timeout: 15_000 }).toBe(200);

    // Started, then closed before sending: the screen waits for its member.
    await page.getByTestId('slot-action').filter({ hasText: 'Waive a fee' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Waive a fee for Casey Customer');
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    const pending = page.getByTestId('pending-screens');
    await expect(pending).toContainText('Waive a fee for Casey Customer');
    await pending.getByRole('button', { name: 'Continue' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog.getByTestId('action-outcome')).toContainText('Withdrawn');
    await dialog.getByTestId('action-outcome').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('pending-screens')).toHaveCount(0);
  });

  test('the case page of a screen left half-way offers to continue it', async ({ page }) => {
    const started = await Api.as(rm).post('/backoffice/actions/waive_fee', { context: { client: client.user.userId } });
    expectStatus(started, 201);
    await openAsTenantUser(page, bank.key, rm, `/app/cases/${started.body.case.id}`);
    await page.getByTestId('resume-screen').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Waive a fee for Casey Customer');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog.getByTestId('action-outcome')).toContainText('Withdrawn');
  });
});

test.describe('BOA-06 Homes', { tag: ['@flow-designer', '@BOA-06'] }, () => {
  test('members holding "Waive fees" land on the servicing desk after signing in; others on the dashboard', async ({ browser }) => {
    const designerApi = Api.as(designer);
    const draft = (await designerApi.get('/backoffice/current')).body.draft;
    expectStatus(await designerApi.put('/backoffice/current/draft', { definition: { ...draft, homes: [{ page: 'servicing', access: { permissions: ['custom:fees.waive'] } }] } }), 200);
    expectStatus(await designerApi.post('/backoffice/current/publish'), 200);

    const theirs = await personaPage(browser, bank.key, rm, '/app/dashboard');
    await expect(theirs).toHaveURL(/\/app\/x\/servicing/);
    await expect(theirs.getByRole('heading', { name: 'Servicing desk' })).toBeVisible();
    await theirs.context().close();
    const others = await personaPage(browser, bank.key, reviewer, '/app/dashboard');
    await expect(others.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
    await expect(others).toHaveURL(/\/app\/dashboard/);
    await others.context().close();
  });
});

test.describe('BOA-01 A page from scratch, then kept for one role', { tag: ['@flow-designer', '@BOA-01'] }, () => {
  test('a designer adds a page to the menu with a widget; everyone gets it, until its rule keeps it for reviewers', async ({ page, browser }) => {
    await openAsTenantUser(page, bank.key, designer, '/app/back-office');
    await page.getByTestId('add-page').click();
    const dialog = page.getByTestId('bo-new-item');
    await dialog.getByLabel(/Title/).fill('Team notes');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByTestId('bo-page').filter({ hasText: 'Team notes' })).toContainText('in the menu');
    await page.getByTestId('add-widget').click();
    await page.getByTestId('widget-palette').locator('[data-type="callout"]').click();
    await page.getByTestId('widget-inspector').getByLabel('Title', { exact: true }).fill('Quarter-end freeze');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
    await page.getByTestId('publish-back-office').click();
    await expect(page.getByText(/Published version \d+/)).toBeVisible();

    const theirs = await personaPage(browser, bank.key, rm, '/app/clients');
    await theirs.getByRole('link', { name: 'Team notes' }).click();
    await expect(theirs.getByText('Quarter-end freeze')).toBeVisible();

    // Only reviewers from now on.
    await page.getByTestId('bo-page').filter({ hasText: 'Team notes' }).click();
    const rule = page.getByTestId('page-access');
    await rule.getByLabel('Only some members').check();
    await rule.getByRole('checkbox', { name: 'Who gets this page: role Reviewer' }).click();
    await expect(page.getByTestId('bo-page').filter({ hasText: 'Team notes' }).getByLabel('Only for some members')).toBeVisible();
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
    await page.getByTestId('publish-back-office').click();
    await expect(page.getByText(/Published version \d+/).last()).toBeVisible();
    await theirs.reload();
    await expect(theirs.getByText('This page does not exist, or it is not for you.')).toBeVisible();
    await expect(theirs.getByRole('link', { name: 'Team notes' })).toHaveCount(0);
    await theirs.context().close();
    const reviewers = await personaPage(browser, bank.key, reviewer, '/app/dashboard');
    await expect(reviewers.getByRole('link', { name: 'Team notes' })).toBeVisible();
    await reviewers.context().close();
  });
});
