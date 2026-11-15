import { test, expect, type Browser, type Page } from '@playwright/test';
import { Api } from '../../support/api';
import { addClient, deleteTenant, DEFAULT_PASSWORD } from '../../support/factories';
import { emailsTo as mailboxEmails, waitForEmail } from '../../support/mailbox';
import { prepareInstitution, type Institution, type Member } from '../../support/scenario';
import { claimFromQueue, decideTask, personaPage, signInThroughForm } from '../../support/ui';

/**
 * SCN-11 Suspicious activity investigation, through the web app. A relationship manager flags a client; the
 * `client.flagged` event opens an investigation case (clientVisibility: requests_only) that moves through
 *   L1 alert triage (reviewer) → investigation (senior reviewer, may ask the client for documents) → MLRO decision
 * with different outcomes: false positive, SAR filed, relationship exited. The client only ever sees a neutral
 * request for information — never the investigation, the SAR or its outcome (no tipping-off).
 */
// Multi-persona journeys: several browser contexts per test, slower when the whole suite runs in parallel.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

let inst: Institution;
const pages: Record<string, Page> = {};

test.beforeAll(async ({ browser }) => {
  inst = await prepareInstitution({
    members: {
      designer: 'flow_designer', rm: 'relationship_manager', analyst: 'reviewer', investigator: 'senior_reviewer',
      mlro: 'compliance_officer', auditor: 'auditor',
    },
  });
  // The compliance team runs the ready-made investigation workflow (its UI set-up is covered by SCN-10).
  const designer = Api.as(inst.members.designer);
  const created = await designer.post('/workflow-templates/suspicious-activity/use');
  expect((await designer.post(`/workflows/${created.body.id}/publish`)).status).toBe(200);
  for (const persona of ['rm', 'analyst', 'investigator', 'mlro', 'auditor'] as const) {
    pages[persona] = await personaPage(browser, inst.bank.key, inst.members[persona], '/app/dashboard');
  }
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

/** Every e-mail sent to `to` since `since`, oldest first. */
async function emailsTo(to: string, since: number) {
  return (await mailboxEmails({ tenant: inst.bank.key, to, since })).reverse();
}

/** The relationship manager flags the client from their profile. */
async function flagClient(client: Member, category: string, observation: string) {
  const rm = pages.rm;
  await rm.goto(inst.bank.url('/app/clients'));
  await rm.getByTestId('client-row').filter({ hasText: client.email }).click();
  await rm.getByRole('button', { name: 'Flag suspicious activity' }).click();
  const dialog = rm.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Category' }).click();
  await rm.getByRole('option', { name: category }).click();
  await dialog.getByLabel('What did you observe?').fill(observation);
  await dialog.getByRole('button', { name: 'Submit flag' }).click();
  await expect(rm.getByText('Flag recorded — the compliance team has been alerted')).toBeVisible();
}

/** The investigation case opened for the client (found by the MLRO, who sees every case). */
async function investigationReference(client: Member) {
  const mlro = pages.mlro;
  await mlro.goto(inst.bank.url('/app/cases'));
  await mlro.getByPlaceholder('Search by reference, title or e-mail').fill(client.email);
  const row = mlro.getByTestId('case-row').filter({ hasText: 'Suspicious activity:' }).first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  return (await row.getAttribute('data-case-reference'))!;
}

async function openQueueTask(page: Page, reference: string, expectedTitle: RegExp | string) {
  await page.goto(inst.bank.url('/app/tasks'));
  await claimFromQueue(page, reference);
  await expect(page.getByTestId('task-title')).toHaveText(expectedTitle);
}

async function casePage(page: Page, reference: string) {
  await page.goto(inst.bank.url('/app/cases'));
  await page.getByPlaceholder('Search by reference, title or e-mail').fill(reference);
  await page.getByTestId('case-row').filter({ hasText: reference }).click();
  await expect(page.getByTestId('case-reference')).toHaveText(reference);
}

async function clientPortal(browser: Browser, client: Member) {
  const page = await (await browser.newContext()).newPage();
  await signInThroughForm(page, inst.bank.url('/sign-on'), client.email, DEFAULT_PASSWORD);
  await expect(page).toHaveURL(/\/portal/);
  return page;
}

test.describe('SCN-11 Suspicious activity: flag, triage, investigation, MLRO decision', { tag: ['@scenario', '@SCN-11'] }, () => {
  test('an alert judged a false positive at triage is closed without bothering the client', { tag: ['@relationship-manager', '@RM-03', '@reviewer', '@REV-02'] }, async () => {
    const client = await addClient(inst.bank, { name: 'Frank Falsepositive' });
    const since = Date.now();
    await flagClient(client, 'Unusual transactions', 'Three large incoming transfers from abroad in one week.');
    const reference = await investigationReference(client);

    await openQueueTask(pages.analyst, reference, /^Triage alert: Three large incoming transfers/);
    await expect(pages.analyst.getByTestId('task-description')).toContainText(`Flagged by ${inst.members.rm.email}`);
    await decideTask(pages.analyst, 'False positive', 'Transfers are the documented sale of a property abroad.');
    await expect(pages.analyst.getByTestId('task-decision')).toContainText('False positive');

    await casePage(pages.mlro, reference);
    await expect(pages.mlro.getByTestId('case-status')).toHaveText('Closed');
    await expect(pages.mlro.getByTestId('case-outcome')).toHaveText('False positive');
    expect(await emailsTo(client.email, since)).toHaveLength(0);
  });

  test('an investigation with a request to the client ends with a SAR filed by the MLRO, without tipping off the client', { tag: ['@reviewer', '@REV-03', '@senior-reviewer', '@compliance', '@CMP-04', '@client', '@CLI-05'] }, async ({ browser }) => {
    const client = await addClient(inst.bank, { name: 'Sid Structuring' });
    const since = Date.now();
    await flagClient(client, 'Structuring', 'Cash deposits of 9,500 on five consecutive days, just under the reporting threshold.');
    const reference = await investigationReference(client);

    // The flagger does not get to follow the investigation (need-to-know).
    await pages.rm.goto(inst.bank.url('/app/cases'));
    await expect(pages.rm.getByTestId('case-row').filter({ hasText: reference })).toHaveCount(0);

    // L1 triage escalates.
    await openQueueTask(pages.analyst, reference, /^Triage alert: Cash deposits/);
    await decideTask(pages.analyst, 'Escalate to investigation', 'Matches the structuring typology; needs investigation.');

    // The investigator asks the client for supporting documents.
    await openQueueTask(pages.investigator, reference, 'Investigate: Sid Structuring');
    await decideTask(pages.investigator, 'Ask the client for documents', 'Please explain the source of the cash deposited between 3 and 7 November and provide supporting documents (e.g. sale invoices).');
    await expect(pages.investigator.getByText('Waiting for the client to answer your request')).toBeVisible();

    // The client receives a neutral request: no case, no mention of an investigation.
    const request = await waitForEmail({ tenant: inst.bank.key, to: client.email, subject: 'We need some information from you', since });
    expect(`${request.subject} ${request.text}`).not.toMatch(/suspicious|investigat|SAR|report|C-\d{4}-/i);
    const portal = await clientPortal(browser, client);
    await expect(portal.getByText('You have no applications yet.')).toBeVisible();
    await portal.getByRole('link', { name: 'Requests' }).click();
    const card = portal.getByTestId('client-request').filter({ hasText: 'More information needed' });
    await expect(card.getByTestId('request-description')).toContainText('source of the cash');
    await card.getByLabel('Your answer').fill('The cash comes from selling my car privately; the signed sale contract is attached to my e-mail to the branch.');
    await card.getByRole('button', { name: 'Send answer' }).click();
    await expect(portal.getByText('Thank you — your answer was sent')).toBeVisible();

    // Back with the investigator, who refers to the MLRO.
    await pages.investigator.reload();
    await expect(pages.investigator.getByTestId('client-answers')).toContainText('selling my car privately');
    await decideTask(pages.investigator, 'Refer to the MLRO', 'Explanation does not match the amounts and timing of the deposits.');

    // The MLRO files a SAR (high-authority decision).
    await openQueueTask(pages.mlro, reference, 'MLRO decision: Sid Structuring');
    await expect(pages.mlro.getByText('High authority', { exact: true })).toBeVisible();
    await decideTask(pages.mlro, 'File a suspicious activity report', 'SAR submitted to the FIU, reference FIU-2026-0042.');
    await expect(pages.mlro.getByTestId('task-decision')).toContainText('File SAR');

    await casePage(pages.mlro, reference);
    await expect(pages.mlro.getByTestId('case-status')).toHaveText('Closed');
    await expect(pages.mlro.getByTestId('case-outcome')).toHaveText('SAR filed');
    await expect(pages.mlro.getByTestId('case-flag').filter({ hasText: 'SAR filed' })).toBeVisible();
    const timeline = pages.mlro.getByTestId('timeline');
    for (const action of ['case.created', 'task.information_requested', 'client_request.answered', 'case.closed']) {
      await expect(timeline.locator(`[data-action="${action}"]`).first()).toBeVisible();
    }

    // The client was told nothing after answering.
    const mails = await emailsTo(client.email, since);
    expect(mails.map((m) => m.subject)).toEqual(['We need some information from you']);
  });

  test('the MLRO can decide to exit the relationship; the auditor reviews the case read-only', { tag: ['@compliance', '@CMP-04', '@auditor', '@AUD-01'] }, async () => {
    const client = await addClient(inst.bank, { name: 'Eve Exit' });
    await flagClient(client, 'Adverse media', 'Named in a press investigation into an unlicensed money service business.');
    const reference = await investigationReference(client);

    await openQueueTask(pages.analyst, reference, /^Triage alert: Named in a press investigation/);
    await decideTask(pages.analyst, 'Escalate to investigation', 'Credible adverse media.');
    await openQueueTask(pages.investigator, reference, 'Investigate: Eve Exit');
    await decideTask(pages.investigator, 'Refer to the MLRO', 'Activity consistent with an unlicensed MSB.');
    await openQueueTask(pages.mlro, reference, 'MLRO decision: Eve Exit');
    await decideTask(pages.mlro, 'Exit the relationship', 'Outside risk appetite; close accounts with notice.');

    await casePage(pages.auditor, reference);
    await expect(pages.auditor.getByTestId('case-outcome')).toHaveText('Relationship exited');
    await expect(pages.auditor.getByTestId('decision')).toHaveCount(3);
    await pages.auditor.getByTestId('case-task').filter({ hasText: 'MLRO decision' }).getByRole('button').click();
    await expect(pages.auditor.getByTestId('task-decision')).toContainText('Exit relationship');
    await expect(pages.auditor.getByRole('button', { name: 'Confirm decision' })).toHaveCount(0);
    await expect(pages.auditor.getByRole('button', { name: 'Claim this task' })).toHaveCount(0);
  });
});
