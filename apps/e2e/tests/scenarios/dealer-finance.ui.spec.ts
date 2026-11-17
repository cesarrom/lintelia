import { test, expect, type Page } from '../../support/test';
import { Api } from '../../support/api';
import { appClient, systemApi } from '../../support/client-app';
import { deleteTenant } from '../../support/factories';
import { env } from '../../support/env';
import { requireFake } from '../../support/fakes';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { claimFromQueue, decideTask, openAsTenantUser, personaPage, signInWithCode, useSession } from '../../support/ui';
import { dealDocuments, dealLog, quickbooksCompany, sampleDeal } from '../../support/dealer-finance';
import { documentPdf } from '../../support/uploads';
import { randomBytes } from 'node:crypto';

/**
 * SCN-12 Dealer finance, as the people involved see it (docs/plans/12) — best watched with E2E_VISUAL=1:
 * the designer installs the dealer & borrower portal wired to the institution's systems; a dealer submits a deal with
 * its stipulations; the underwriter works it from the pipeline with what the AI read, asks for a document, approves;
 * the buyer and the dealer sign in Documenso; the dealer sends the funding package; the funding team funds; QuickBooks,
 * the deal log and LoanPro fill up; the buyer signs in to their new app and pays; LoanPro's servicing events reach them;
 * the title arrives.
 */
test.describe.configure({ timeout: 420_000 });

let inst: Institution;

test.beforeAll(async () => {
  for (const fake of ['llm', 'loanpro', 'documenso', 'sheets', 'quickbooks'] as const) await requireFake(fake);
  inst = await prepareInstitution({
    members: { designer: 'flow_designer', underwriter: 'reviewer', funder: 'senior_reviewer' },
    connections: ['ai', 'loanpro', 'documenso', 'sheets', 'quickbooks'],
  });
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

/** A journey screen field by its label (optional fields say so after the label). */
const field = (page: Page, label: string | RegExp) => page.getByTestId('journey')
  .getByLabel(typeof label === 'string' ? new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\(optional\\))?$`) : label);

test.describe('SCN-12 Dealer finance, end to end in the browser', { tag: ['@scenario', '@SCN-12', '@AUT-01', '@AUT-03', '@APP-01'] }, () => {
  test('install the portal, a deal from the dealer to a boarded loan, the borrower pays in their app', async ({ page, browser }) => {
    const spreadsheetId = `deal-log-${randomBytes(4).toString('hex')}`;
    const realm = String(9_140_000_000 + Math.floor(Math.random() * 1e9));
    const deal = sampleDeal({ buyerName: 'Jamie Rivera' });

    await test.step('The designer installs the dealer & borrower portal, wired to the institution\'s systems', async () => {
      await openAsTenantUser(page, inst.bank.key, inst.members.designer, '/app/experience');
      await expect(page.getByTestId('studio')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('open-templates').click();
      await page.locator('[data-template="dealer-finance"]').getByRole('button', { name: 'Use this template' }).click();
      const setup = page.getByTestId('template-setup');
      // Connections are preselected (one of a kind, or by name: the two HTTP APIs).
      await expect(setup.getByTestId('need-AI')).toHaveValue(inst.connections.ai);
      await expect(setup.getByTestId('need-SHEETS')).toHaveValue(inst.connections.sheets);
      await expect(setup.getByTestId('need-QUICKBOOKS')).toHaveValue(inst.connections.quickbooks);
      await setup.getByTestId('param-SPREADSHEET_ID').fill(spreadsheetId);
      await setup.getByTestId('param-QBO_REALM').fill(realm);
      await setup.getByTestId('template-install').click();
      await expect(page.getByText('Template loaded into the draft')).toBeVisible({ timeout: 60_000 });
      await expect(page.frameLocator('[data-testid=preview-frame]').getByTestId('hero')).toBeVisible();
      await page.getByTestId('publish-app').click();
      await expect(page.getByText('Published version 1')).toBeVisible({ timeout: 20_000 });
    });

    // A dealership's user, made a dealer by the institution's dealer management system.
    const dealer = await appClient(inst.bank, { name: 'Dana Dealer', phone: '+1 512 555 0100' });
    const system = await systemApi(inst.bank, ['clients:provision', 'clients:records'], 'Dealer management');
    await system.patch(`/clients/${dealer.user.userId}/profile`, { addSegments: ['dealer'], attributes: { dealerName: 'Sunrise Motors' } });
    const dealerPage = await browser.newContext().then((c) => c.newPage());
    await useSession(dealerPage, dealer);
    const docs = await dealDocuments(deal);
    let reference = '';

    await test.step('The dealer submits a deal with its stipulations', async () => {
      await dealerPage.goto(inst.bank.url('/portal'));
      await expect(dealerPage.getByTestId('hero')).toContainText('Sunrise Motors', { timeout: 30_000 });
      await dealerPage.getByTestId('quick-action').filter({ hasText: 'Submit a deal' }).click();
      await expect(dealerPage.getByTestId('screen-title')).toHaveText('The deal', { timeout: 30_000 });
      await expect(field(dealerPage, 'Dealership')).toHaveValue('Sunrise Motors');
      await field(dealerPage, "Buyer's full name").fill(deal.buyerName);
      await field(dealerPage, "Buyer's e-mail").fill(deal.buyerEmail);
      await field(dealerPage, "Buyer's mobile").fill(deal.buyerPhone);
      await field(dealerPage, 'Vehicle year').fill(String(deal.year));
      await field(dealerPage, 'Make').fill(deal.make);
      await field(dealerPage, 'Model').fill(deal.model);
      await field(dealerPage, 'VIN').fill(deal.vin);
      await field(dealerPage, 'Sale price').fill(String(deal.salePrice));
      await field(dealerPage, 'Down payment').fill(String(deal.downPayment));
      await field(dealerPage, 'Amount financed').fill(String(deal.amountFinanced));
      await field(dealerPage, 'Term').selectOption(deal.termMonths);
      await field(dealerPage, 'APR (%)').fill(String(deal.apr));
      await field(dealerPage, /gross monthly income/).fill(String(deal.statedIncome));
      await dealerPage.getByTestId('screen-button-continue').click();

      await expect(dealerPage.getByTestId('screen-title')).toHaveText('Documents we need');
      const inputs = dealerPage.locator('input[type=file]');
      await inputs.nth(0).setInputFiles({ name: 'pay-stub.pdf', mimeType: 'application/pdf', buffer: docs.payStub });
      await inputs.nth(1).setInputFiles({ name: 'buyers-order.pdf', mimeType: 'application/pdf', buffer: docs.buyersOrder });
      await inputs.nth(2).setInputFiles({ name: 'drivers-license.pdf', mimeType: 'application/pdf', buffer: docs.license });
      await expect(dealerPage.getByTestId('upload').and(dealerPage.locator('[data-status="available"]'))).toHaveCount(3, { timeout: 45_000 });
      await dealerPage.getByTestId('screen-button-submit').click();
      await expect(dealerPage.getByTestId('journey-waiting')).toBeVisible({ timeout: 30_000 });
      reference = (await dealerPage.getByTestId('journey').getAttribute('data-case-reference'))!;
      await expect(dealerPage.getByTestId('journey-stages').locator('[data-status="current"]')).toContainText('Underwriting');
    });

    const underwriter = await personaPage(browser, inst.bank.key, inst.members.underwriter, '/app/cases');
    await test.step('The underwriter finds the deal on the pipeline, with what the AI read and the numbers', async () => {
      await underwriter.getByTestId('cases-view-pipeline').click({ timeout: 30_000 });
      const column = underwriter.locator('[data-testid=pipeline-column][data-stage=underwriting]');
      await expect(column.getByTestId('pipeline-card').filter({ hasText: reference })).toBeVisible({ timeout: 60_000 });
      await expect(column.getByTestId('pipeline-card')).toContainText('Jamie Rivera · 2022 Honda Accord (Sunrise Motors)');
      await underwriter.goto(inst.bank.url('/app/tasks'));
      await claimFromQueue(underwriter, reference);
      await expect(underwriter.getByText('Pay stub (AI): Northwind Logistics, $5,400.00/month (declared $5,500.00)')).toBeVisible();
      await expect(underwriter.getByText('Buyer order (AI): VIN matches, amount matches')).toBeVisible();
      // Ask the dealer for a document.
      await underwriter.getByRole('button', { name: 'Ask the dealer' }).click();
      await underwriter.getByLabel(/What do you need/).fill("Send a proof of residence for the buyer (utility bill or lease)");
      await underwriter.getByTestId('ask-for-document').check();
      await underwriter.getByRole('button', { name: 'Confirm decision' }).click();
      await expect(underwriter.getByText('Decision recorded')).toBeVisible();
    });

    await test.step('The dealer answers from the portal', async () => {
      await dealerPage.goto(inst.bank.url('/portal'));
      const request = dealerPage.getByTestId('app-request').filter({ hasText: 'More information needed' });
      await expect(request).toBeVisible({ timeout: 45_000 });
      await request.getByRole('button', { name: 'Answer' }).click();
      const card = dealerPage.getByTestId('client-request').filter({ hasText: 'proof of residence' });
      await card.locator('input[type=file]').setInputFiles({ name: 'utility-bill.pdf', mimeType: 'application/pdf', buffer: await documentPdf(['Austin Energy - statement', `Account holder: ${deal.buyerName}`]) });
      await expect(card.getByTestId('upload')).toHaveAttribute('data-status', 'available', { timeout: 30_000 });
      await card.getByRole('button', { name: 'Send answer' }).click();
      await expect(dealerPage.getByText('Thank you — your answer was sent')).toBeVisible();
    });

    await test.step('The underwriter approves', async () => {
      await underwriter.reload();
      await expect(underwriter.getByText('utility-bill.pdf').first()).toBeVisible({ timeout: 30_000 });
      await decideTask(underwriter, /^Approve$/, 'Within policy, residence verified');
      await expect(underwriter.getByText('Decision recorded')).toBeVisible();
    });

    await test.step('The buyer signs the contract at the dealership, then the dealer signs the assignment (Documenso)', async () => {
      await dealerPage.goto(inst.bank.url('/portal/p/deals'));
      const request = dealerPage.getByTestId('app-request').filter({ hasText: 'The buyer signs' });
      await expect(request).toBeVisible({ timeout: 60_000 });
      await request.getByRole('button', { name: 'Answer' }).click();
      await dealerPage.getByTestId('client-action').click();
      const contract = dealerPage.frameLocator('iframe[title="The buyer signs the retail installment contract"]');
      await expect(contract.getByRole('heading', { name: /Retail installment contract/i })).toBeVisible({ timeout: 20_000 });
      await contract.getByRole('button', { name: 'Sign' }).click();
      // Documenso tells the core (signed webhook); the dealer's screen moves on to their own signature.

      const assignment = dealerPage.getByTestId('client-action').filter({ hasText: 'Sign the assignment of the contract' });
      await expect(assignment).toBeVisible({ timeout: 60_000 });
      await assignment.click();
      const frame = dealerPage.frameLocator('iframe[title="Sign the assignment of the contract"]');
      await expect(frame.getByRole('heading', { name: /assignment/i })).toBeVisible({ timeout: 20_000 });
      await frame.getByRole('button', { name: 'Sign' }).click();
    });

    await test.step('The dealer sends the funding package', async () => {
      // (Not "funding package": the assignment's instructions mention it too.)
      const card = dealerPage.getByTestId('client-request').filter({ hasText: 'Upload these to get paid' });
      await expect(card).toBeVisible({ timeout: 60_000 });
      const inputs = card.locator('input[type=file]');
      await inputs.nth(0).setInputFiles({ name: 'title-application.pdf', mimeType: 'application/pdf', buffer: await documentPdf(['Application for Texas title', `VIN: ${deal.vin}`]) });
      await inputs.nth(1).setInputFiles({ name: 'insurance.pdf', mimeType: 'application/pdf', buffer: await documentPdf(['Proof of insurance', `Insured: ${deal.buyerName}`]) });
      await expect(card.getByTestId('upload').and(dealerPage.locator('[data-status="available"]'))).toHaveCount(2, { timeout: 45_000 });
      await card.getByRole('button', { name: 'Send answer' }).click();
      await expect(dealerPage.getByTestId('journey-stages').locator('[data-status="current"]')).toContainText('Funding', { timeout: 30_000 });
    });

    const funder = await personaPage(browser, inst.bank.key, inst.members.funder, '/app/tasks');
    await test.step('The funding team audits the package and funds the dealer', async () => {
      await claimFromQueue(funder, reference);
      await expect(funder.getByText('title-application.pdf').first()).toBeVisible();
      await decideTask(funder, 'Fund the dealer', 'Package complete');
      await expect(funder.getByText('Decision recorded')).toBeVisible();
      await funder.getByRole('button', { name: `Open case ${reference}` }).click();
      await expect(funder.getByTestId('case-stages')).toHaveAttribute('data-stage', 'boarded', { timeout: 90_000 });
      await expect(funder.getByTestId('case-status')).toContainText('Approved', { timeout: 60_000 });
    });

    await test.step('QuickBooks paid the dealer, the deal log filled up, the loan is in LoanPro', async () => {
      const systems = await browser.newContext().then((c) => c.newPage());
      await systems.goto(`${env.fakes.quickbooks}/`);
      const books = systems.locator(`[data-realm="${realm}"]`);
      await expect(books.locator(`[data-bill="${reference}"]`)).toContainText('Sunrise Motors');
      await expect(books.locator(`[data-bill="${reference}"]`)).toContainText('Paid');
      await systems.goto(`${env.fakes.sheets}/`);
      await expect(systems.getByText(reference).first()).toBeVisible();
      await systems.goto(`${env.fakes.loanpro}/`);
      await expect(systems.locator(`[data-loan="${reference}"]`)).toHaveAttribute('data-status', 'Open');
      expect((await quickbooksCompany(realm)).payments).toEqual([expect.objectContaining({ TotalAmt: 20_605 })]);
      expect((await dealLog(spreadsheetId)).filter((row) => row[1] === reference).map((row) => row[6])).toEqual(['In underwriting', 'Funded']);
      await systems.context().close();
    });

    await test.step('The buyer signs in to their new app and pays', async () => {
      const borrowerPage = await browser.newContext().then((c) => c.newPage());
      await signInWithCode(borrowerPage, inst.bank.key, deal.buyerEmail);
      await borrowerPage.getByLabel('I accept the Terms of use').check();
      await borrowerPage.getByLabel('I accept the Privacy notice').check();
      await borrowerPage.getByTestId('accept-consents').click();
      await expect(borrowerPage.getByTestId('hero-value')).toHaveText('$21,000.00', { timeout: 30_000 });
      await expect(borrowerPage.getByTestId('hero')).toContainText('Next payment $434.91');
      await borrowerPage.getByTestId('quick-action').filter({ hasText: 'Make a payment' }).click();
      await expect(borrowerPage.getByTestId('screen-title')).toHaveText('Make a payment');
      await field(borrowerPage, 'Amount (USD)').fill('500');
      await borrowerPage.getByTestId('screen-button-continue').click();
      await expect(borrowerPage.getByTestId('screen-content')).toContainText('$500.00 towards your Auto loan · 2022 Honda Accord');
      await borrowerPage.getByTestId('screen-button-pay').click();
      await expect(borrowerPage.getByTestId('journey-done-title')).toHaveText('Payment received: $500.00', { timeout: 30_000 });
      await borrowerPage.getByTestId('journey-finish').click();
      await expect(borrowerPage).toHaveURL(/\/portal\/p\/loan$/);
      await expect(borrowerPage.getByTestId('table').getByRole('row')).toHaveCount(2, { timeout: 20_000 });
      await expect(borrowerPage.getByTestId('hero-value')).not.toHaveText('$21,000.00', { timeout: 20_000 });

      // LoanPro reports a missed payment (its back office); the servicing workflow tells the borrower.
      const loanpro = await browser.newContext().then((c) => c.newPage());
      await loanpro.goto(`${env.fakes.loanpro}/`);
      await loanpro.locator(`[data-loan="${reference}"]`).getByRole('button', { name: 'Missed payment' }).click();
      await expect(loanpro.locator(`[data-loan="${reference}"]`)).toHaveAttribute('data-status', 'Delinquent');
      // LoanPro's webhook → the connector → the servicing workflow → a notification in the app.
      await expect(async () => {
        await borrowerPage.reload();
        await borrowerPage.getByTestId('notifications-bell').click({ timeout: 5000 });
        await expect(borrowerPage.getByText('Your payment is past due')).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 60_000 });
      await loanpro.context().close();
    });

    await test.step('The title arrives by mail; the administrator records it on the title case', async () => {
      const ops = await personaPage(browser, inst.bank.key, inst.bank.admin, '/app/cases');
      await ops.getByPlaceholder('Search by reference, title or e-mail').fill(reference);
      await ops.getByTestId('case-row').filter({ hasText: 'Title:' }).click();
      await expect(ops.getByTestId('case-stages')).toHaveAttribute('data-stage', 'waiting', { timeout: 30_000 });
      const signal = ops.locator('[data-testid=case-signal][data-name=title_received]');
      await expect(signal).toHaveAttribute('data-status', 'waiting');
      await signal.getByTestId('record-signal').click();
      await ops.getByTestId('signal-body').fill(JSON.stringify({ titleNumber: 'TX-88213409', state: 'TX', lienholder: inst.bank.tenant.name }, null, 2));
      await ops.getByTestId('signal-submit').click();
      await expect(ops.getByTestId('case-stages')).toHaveAttribute('data-stage', 'perfected', { timeout: 30_000 });
      await expect(ops.getByTestId('case-status')).toContainText('Completed', { timeout: 30_000 });
    });
  });
});
