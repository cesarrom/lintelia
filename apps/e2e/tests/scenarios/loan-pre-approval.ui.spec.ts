import { test, expect, type Page } from '@playwright/test';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { waitForEmail } from '../../support/mailbox';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { FakeWebsite } from '../../support/website';
import { claimFromQueue, confirmApplication, embeddedForm, decideTask, openInstitutionWebsite, personaPage, signInWithCode } from '../../support/ui';

/**
 * SCN-10 Personal loan pre-approval, entirely through the web app:
 *  - the flow designer builds the application form in the form builder, creates the workflow from the loan template,
 *    publishes both and embeds the form on the bank's website (another origin);
 *  - applicants apply from that website and confirm their e-mail with a code;
 *  - small affordable loans are pre-approved automatically, mid-size ones go to the reviewers' queue, loans above
 *    50,000 need two senior reviewers (four-eyes); applicants follow their application in the portal.
 */
// Multi-persona journeys: several browser contexts per test, slower when the whole suite runs in parallel.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

let inst: Institution;
let designer: Page;
let embedSnippet = '';
// The bank's public website and an unrelated site, on their own origins.
const website = new FakeWebsite('www.bank-site.localhost');
const copycat = new FakeWebsite('copycat-site.localhost');
const FORM_NAME = 'Personal loan pre-approval';

test.beforeAll(async ({ browser }) => {
  inst = await prepareInstitution({
    members: { designer: 'flow_designer', analyst: 'reviewer', lead: 'senior_reviewer', lead2: 'senior_reviewer' },
  });
  designer = await personaPage(browser, inst.bank.key, inst.members.designer, '/app/forms');
  await website.start();
  await copycat.start();
});
test.afterAll(async () => {
  await website.stop();
  await copycat.stop();
  await deleteTenant(inst?.bank);
});

/** An applicant applies on the bank's website and confirms their e-mail; returns the case reference. */
async function applyOnWebsite(page: Page, applicant: { name: string; email: string; amount: number; income: number }) {
  await openInstitutionWebsite(page, website, embedSnippet);
  const form = await embeddedForm(page, FORM_NAME);
  await form.getByLabel('Full name').fill(applicant.name);
  await form.getByLabel('E-mail').fill(applicant.email);
  await form.getByLabel('Loan amount').fill(String(applicant.amount));
  await form.getByLabel('Annual income').fill(String(applicant.income));
  const since = Date.now() - 1000;
  await form.getByRole('button', { name: 'Submit' }).click();
  return confirmApplication(form, inst.bank.key, applicant.email, since);
}

test.describe('SCN-10 Loan pre-approval from a form embedded on the bank website', { tag: ['@scenario', '@SCN-10'] }, () => {
  test('the designer builds the application form by adding fields in the form builder', { tag: ['@flow-designer', '@DES-01'] }, async () => {
    await designer.getByRole('button', { name: 'Create Form' }).click();
    const dialog = designer.getByRole('dialog');
    await dialog.getByLabel('Form name').fill(FORM_NAME);
    await dialog.getByLabel('Description').fill('Find out in minutes how much you can borrow.');

    const fields: Array<[string, string, string]> = [
      ['Add Text Field', 'fullName', 'Full name'],
      ['Add Email', 'email', 'E-mail'],
      ['Add Number Field', 'amount', 'Loan amount'],
      ['Add Number Field', 'annualIncome', 'Annual income'],
    ];
    const properties = dialog.getByRole('region', { name: 'Properties' });
    for (const [component, property, label] of fields) {
      await dialog.getByTitle(component).click();
      await properties.getByPlaceholder('Enter property name').fill(property);
      await properties.getByPlaceholder('Enter label').fill(label);
    }
    const canvas = dialog.getByRole('region', { name: 'Form canvas' });
    for (const [, , label] of fields) await expect(canvas.getByText(label, { exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Create Form' }).click();
    await expect(designer.getByTestId('form-row').filter({ hasText: FORM_NAME })).toBeVisible();
  });

  test('the designer creates the workflow from the loan template and publishes it', { tag: ['@flow-designer', '@DES-02', '@DES-05'] }, async () => {
    await designer.goto(inst.bank.url('/app/workflows'));
    await designer.getByRole('button', { name: 'New from template' }).click();
    await designer.getByTestId('workflow-template').filter({ hasText: 'Personal loan pre-approval' }).getByRole('button', { name: 'Use template' }).click();
    const row = designer.getByTestId('workflow-row').filter({ hasText: 'Personal loan pre-approval' });
    await expect(row.getByTestId('workflow-version')).toHaveText('Draft');
    await row.getByRole('button', { name: /Actions for/ }).click();
    await designer.getByRole('menuitem', { name: 'Publish' }).click();
    await expect(row.getByTestId('workflow-version')).toHaveText('v1');
  });

  test('the designer publishes the form for the bank website and copies the embed snippet', { tag: ['@flow-designer', '@DES-01', '@DES-03'] }, async () => {
    await designer.goto(inst.bank.url('/app/forms'));
    const row = designer.getByTestId('form-row').filter({ hasText: FORM_NAME });
    await row.getByRole('button', { name: `Actions for ${FORM_NAME}` }).click();
    await designer.getByRole('menuitem', { name: 'Publish & embed' }).click();
    const dialog = designer.getByRole('dialog');
    await dialog.getByRole('combobox', { name: 'Workflow' }).click();
    await designer.getByRole('option', { name: /Personal loan pre-approval \(v1\)/ }).click();
    await dialog.getByLabel(/Websites allowed to embed it/).fill(website.origin);
    await dialog.getByRole('button', { name: 'Publish' }).click();
    await expect(dialog.getByTestId('embed-script')).toContainText('data-fintivio-form=');
    embedSnippet = (await dialog.getByTestId('embed-script').textContent())!;
    await designer.keyboard.press('Escape');
    await expect(row.getByText('Published', { exact: true })).toBeVisible();
  });

  test('the embedded form refuses to load on a site that was not allowed', { tag: ['@DES-01'] }, async ({ page }) => {
    await openInstitutionWebsite(page, copycat, embedSnippet);
    // The snippet runs and inserts the iframe, but the browser refuses to render the form inside another site
    // (CSP frame-ancestors), and the API would refuse the origin anyway.
    await expect(page.locator(`iframe[title="${FORM_NAME}"]`)).toHaveCount(1);
    await page.waitForTimeout(1500);
    const framed = page.frames().find((f) => f.url().includes('/embed/forms/'));
    expect(await framed?.getByTestId('embed-form-title').count() ?? 0).toBe(0);
  });

  test('a small affordable loan is pre-approved automatically and the applicant follows it in the portal', { tag: ['@client', '@CLI-03', '@CLI-07'] }, async ({ page, browser }) => {
    const email = uniqueEmail('small-loan', 'customers.example');
    const reference = await applyOnWebsite(page, { name: 'Sam Small', email, amount: 5000, income: 60000 });

    const decision = await waitForEmail({ tenant: inst.bank.key, to: email, subject: `Your application ${reference}: approved`, timeoutMs: 20_000 });
    expect(decision.text).toContain('you are pre-approved');

    const portal = await (await browser.newContext()).newPage();
    await signInWithCode(portal, inst.bank.key, email);
    const card = portal.getByTestId('portal-case').filter({ hasText: reference });
    await expect(card).toContainText('Approved');
    await card.click();
    await expect(portal.getByTestId('portal-case-status')).toHaveText('Approved');
  });

  test('a mid-size loan goes to the credit review queue and a reviewer approves it', { tag: ['@reviewer', '@REV-01', '@REV-02'] }, async ({ page, browser }) => {
    const email = uniqueEmail('mid-loan', 'customers.example');
    const reference = await applyOnWebsite(page, { name: 'Mia Mid', email, amount: 20000, income: 90000 });

    const analyst = await personaPage(browser, inst.bank.key, inst.members.analyst, '/app/tasks');
    await claimFromQueue(analyst, reference);
    await expect(analyst.getByTestId('task-title')).toHaveText('Credit review: Mia Mid requests 20000');
    await expect(analyst.getByTestId('calculation')).toContainText('Monthly Payment');
    await decideTask(analyst, 'Approve', 'Income covers the repayments comfortably');
    await expect(analyst.getByTestId('task-decision')).toContainText('Approve');

    await analyst.getByRole('button', { name: `Open case ${reference}` }).click();
    await expect(analyst.getByTestId('case-status')).toHaveText('Approved');
    await expect(analyst.getByTestId('decision')).toContainText(inst.members.analyst.email);
    await waitForEmail({ tenant: inst.bank.key, to: email, subject: `Your application ${reference}: approved`, timeoutMs: 20_000 });
  });

  test('a loan above 50,000 needs two different senior reviewers (four-eyes)', { tag: ['@senior-reviewer', '@SUP-01'] }, async ({ page, browser }) => {
    const email = uniqueEmail('big-loan', 'customers.example');
    const reference = await applyOnWebsite(page, { name: 'Bo Big', email, amount: 60000, income: 200000 });

    // Not for first-line reviewers.
    const analyst = await personaPage(browser, inst.bank.key, inst.members.analyst, '/app/tasks');
    await analyst.getByRole('tab', { name: 'Team queue' }).click();
    await expect(analyst.getByText('Credit review: Bo Big requests 60000')).toHaveCount(0);

    const lead = await personaPage(browser, inst.bank.key, inst.members.lead, '/app/tasks');
    await claimFromQueue(lead, reference);
    await decideTask(lead, 'Approve', 'Verified income and collateral');
    await expect(lead.getByTestId('first-approval')).toContainText(inst.members.lead.email);
    // The first approver cannot give the second approval.
    await expect(lead.getByRole('button', { name: 'Confirm decision' })).toHaveCount(0);

    const lead2 = await personaPage(browser, inst.bank.key, inst.members.lead2, '/app/tasks');
    await lead2.getByRole('tab', { name: 'Team queue' }).click();
    const row = lead2.getByTestId('task-row').filter({ hasText: reference });
    await expect(row).toContainText('Second approval');
    await row.getByRole('button', { name: 'Open' }).click();
    await expect(lead2.getByTestId('first-approval')).toContainText(inst.members.lead.email);
    await decideTask(lead2, 'Confirm approval (second approver)');
    await expect(lead2.getByTestId('task-decision')).toContainText('Approve');

    await lead2.getByRole('button', { name: `Open case ${reference}` }).click();
    await expect(lead2.getByTestId('case-status')).toHaveText('Approved');
    const decisions = lead2.getByTestId('decision');
    await expect(decisions).toHaveCount(2);
    await expect(decisions.nth(0)).toContainText(`first approval) by ${inst.members.lead.email}`);
    await expect(decisions.nth(1)).toContainText(inst.members.lead2.email);
    await expect(lead2.getByTestId('timeline').locator('[data-action="task.first_approval"]')).toBeVisible();
  });

  test('a loan the applicant cannot afford is declined automatically with a polite e-mail', { tag: ['@client', '@CLI-07'] }, async ({ page }) => {
    const email = uniqueEmail('unaffordable', 'customers.example');
    const reference = await applyOnWebsite(page, { name: 'Una Affordable', email, amount: 40000, income: 20000 });
    const mail = await waitForEmail({ tenant: inst.bank.key, to: email, subject: `Your application ${reference}: not approved`, timeoutMs: 20_000 });
    expect(mail.text).toContain('we cannot pre-approve');
  });
});
