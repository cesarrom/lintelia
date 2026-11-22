import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { appClient, startJourney, submitScreen, waitForJourney } from '../../support/client-app';
import { deleteTenant } from '../../support/factories';
import { controlFake } from '../../support/fakes';
import { emailsTo, waitForEmail } from '../../support/mailbox';
import { clientSignIn, waitForCase, waitForTask } from '../../support/scenario';
import { documentPdf, uploadForRequest } from '../../support/uploads';
import {
  DEALER_FEE, dealDocuments, dealerUser, dealLog, decideDeal, loanproAction, loanproLoans, prepareDealerFinance, quickbooksCompany, sampleDeal, submitDeal,
  type DealerFinance,
} from '../../support/dealer-finance';

/**
 * SCN-12 Dealer finance (docs/plans/12), through the APIs: the "Dealer & borrower portal" solution wired to AI, LoanPro,
 * Documenso, Google Sheets and QuickBooks; a dealer applies and sends deals; automation before people; underwriting
 * asks for more; contracts; funding; boarding; the borrower's app and LoanPro servicing events.
 */
test.describe.configure({ timeout: 240_000 });

let df: DealerFinance;

test.beforeAll(async () => { df = await prepareDealerFinance(); });
test.afterAll(async () => { await deleteTenant(df?.inst.bank); });

const data = async (me: Api, sources: string[]) => (await me.post('/me/app/data', { sources })).body;

test.describe('SCN-12 Dealer finance', { tag: ['@scenario', '@SCN-12', '@AUT-02', '@AUT-03', '@AUT-04', '@AUT-05', '@AUT-06', '@AUT-07'] }, () => {
  test('the template needs the right connections, and installs its functions, servicing workflows and journeys', async () => {
    const designer = df.designer;
    const connections = { AI: df.inst.connections.ai, LOANPRO: df.inst.connections.loanpro, DOCUMENSO: df.inst.connections.documenso, SHEETS: df.inst.connections.sheets, QUICKBOOKS: df.inst.connections.quickbooks };
    const missing = await designer.post('/client-apps/current/template', { template: 'dealer-finance', connections: { ...connections, LOANPRO: undefined } });
    expectStatus(missing, 400);
    expect(missing.body.error).toContain('Choose a LoanPro connection');
    const wrongKind = await designer.post('/client-apps/current/template', { template: 'dealer-finance', connections: { ...connections, AI: df.inst.connections.sheets } });
    expectStatus(wrongKind, 400);
    expect(wrongKind.body.error).toContain('not a ai connection');
    const badParameter = await designer.post('/client-apps/current/template', { template: 'dealer-finance', connections, parameters: { QBO_REALM: '12; drop' } });
    expectStatus(badParameter, 400);

    const workflows = (await designer.get('/workflows')).body as Array<{ name: string; status: string; id: string }>;
    const names = workflows.map((w) => w.name);
    expect(names).toEqual(expect.arrayContaining([
      'Function: log a deal to the spreadsheet', 'Function: pay the dealer in QuickBooks', 'Dealer: title tracking', 'Dealer: deal', 'Dealer: become a partner',
      'Servicing: payment received', 'Servicing: missed payment', 'Servicing: loan paid off', 'Borrower: make a payment', 'Borrower: payoff quote', 'Borrower: payment difficulty',
    ]));
    expect(workflows.filter((w) => names.includes(w.name)).every((w) => w.status === 'active')).toBe(true);
    // The functions show in the workflow editor's palette, as steps other workflows can use.
    const components = (await designer.get('/workflow-components')).body as Array<{ type: string; title: string; category: string }>;
    expect(components.filter((c) => c.category === 'function').map((c) => c.title)).toEqual(expect.arrayContaining(['Function: log a deal to the spreadsheet', 'Function: pay the dealer in QuickBooks']));
  });

  test('a dealership applies on the portal; the team approves it and it can send deals', async () => {
    const applicant = await appClient(df.inst.bank, { name: 'Pat Partner' });
    const me = Api.as(applicant);
    expect((await data(me, ['journeys'])).journeys.map((j: any) => j.key)).toEqual(['dealer_signup']);
    let state = await startJourney(me, 'dealer_signup');
    let res = await submitScreen(me, state, 'continue', { dealerName: 'Hill Country Autos', licenseNumber: 'P-104233', state: 'TX', ein: '74-1234567', phone: '+1 512 555 0199', monthlyVolume: 25 });
    expectStatus(res, 200);
    state = res.body.screen?.stage === 'documents' ? res.body : await waitForJourney(me, state.case.id, (s) => s.screen?.stage === 'documents');
    const licence = await uploadForRequest(me, { taskId: state.screen.taskId, itemKey: 'dealerLicense', name: 'licence.pdf', type: 'application/pdf', bytes: await documentPdf(['Texas DMV - Dealer license', 'License: P-104233']) });
    const w9 = await uploadForRequest(me, { taskId: state.screen.taskId, itemKey: 'w9', name: 'w9.pdf', type: 'application/pdf', bytes: await documentPdf(['Form W-9', 'EIN: 74-1234567']) });
    res = await submitScreen(me, state, 'submit', { dealerLicense: [licence.outcome!.fileId], w9: [w9.outcome!.fileId], agree: true });
    expectStatus(res, 200);
    state = await waitForJourney(me, state.case.id, (s) => s.state === 'waiting');
    expect(state.stages.find((s: any) => s.status === 'current')?.label).toBe('Our checks');

    // Dealer approvals are for the funding team (senior reviewers), with the case retitled by the workflow.
    const task = await decideDeal(df.funder, state.case.id, 'approve', 'Licence and W-9 verified');
    expect(task.title).toBe('Dealer application: Hill Country Autos');
    await waitForJourney(me, state.case.id, (s) => s.state === 'done');
    const after = await data(me, ['me', 'journeys']);
    expect(after.me.segments).toContain('dealer');
    expect(after.me).toMatchObject({ dealerName: 'Hill Country Autos', dealerLicense: 'P-104233' });
    expect(after.journeys.map((j: any) => j.key)).toEqual(['submit_deal']);
  });

  test('a deal from submission to a boarded loan: AI, numbers, the log, questions to the dealer, contracts, funding, QuickBooks, LoanPro', async () => {
    const dealer = await dealerUser(df, 'Sunrise Motors');
    const me = Api.as(dealer);
    const deal = sampleDeal();
    await controlFake('documenso', '/signatures', { email: deal.buyerEmail, outcome: 'signed' });
    await controlFake('documenso', '/signatures', { email: dealer.email, outcome: 'signed' });
    const since = Date.now() - 1000;

    const kase = await submitDeal(me, deal);
    const staff = df.underwriter;

    // Automation before people: the AI read the documents, the numbers were checked, the deal was logged.
    const task = await waitForTask(staff, kase.id, { timeoutMs: 60_000 });
    expect(task.title).toBe('Credit decision: Jamie Rivera · $21,000.00');
    expect(task.description).toContain('Payment $434.91/month');
    expect(task.description).toContain('Pay stub (AI): Northwind Logistics, $5,400.00/month (declared $5,500.00)');
    expect(task.description).toContain('Buyer order (AI): VIN matches, amount matches');
    expect(task.description).not.toContain('Flags:');
    const view = (await staff.get(`/cases/${kase.id}`)).body;
    expect(view.stage).toBe('underwriting');
    expect(view.title).toBe('Deal: Jamie Rivera · 2022 Honda Accord (Sunrise Motors)');
    expect(view.data).toMatchObject({ dealer: 'Sunrise Motors', vehicle: '2022 Honda Accord' });
    expect((await dealLog(df.spreadsheetId)).find((row) => row[1] === kase.reference)).toEqual(expect.arrayContaining(['Sunrise Motors', 'Jamie Rivera', '2022 Honda Accord', '21000', 'In underwriting']));
    // The extraction is kept on the case as a record of the AI connector.
    expect(view.records ?? view.results ?? []).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'document', connectorId: 'ai' })]));

    // The underwriter asks the dealer for more; the dealer answers from the portal; the task comes back.
    expectStatus(await staff.post(`/tasks/${task.id}/claim`), 200);
    expectStatus(await staff.post(`/tasks/${task.id}/decision`, { decision: 'request_info', reason: 'Send a proof of residence for the buyer', items: [{ key: 'residence', label: 'Proof of residence', type: 'file' }] }), 200);
    const request = await waitForRequest(me, kase.id);
    expect(request).toMatchObject({ title: 'More information needed', description: 'Send a proof of residence for the buyer' });
    const bill = await uploadForRequest(me, { taskId: request.id, itemKey: 'residence', name: 'utility-bill.pdf', type: 'application/pdf', bytes: await documentPdf(['Austin Energy', `Account holder: ${deal.buyerName}`]) });
    expectStatus(await me.post(`/me/cases/${kase.id}/requests/${request.id}/respond`, { response: { residence: [bill.outcome!.fileId] } }), 200);
    await expect.poll(async () => (await staff.get(`/tasks/${task.id}`)).body.status, { timeout: 15_000 }).toBe('claimed');
    expectStatus(await staff.post(`/tasks/${task.id}/decision`, { decision: 'approve', reason: 'Within policy' }), 200);

    // Contracts: the buyer, then the dealer sign in Documenso (preset to sign at once in the fake).
    const dealerView = await waitForJourney(me, kase.id, (s) => s.stages?.find((x: any) => x.status === 'current')?.key === 'funding', 60_000);
    expect(dealerView.stages.filter((s: any) => s.status === 'done').map((s: any) => s.key)).toEqual(['submitted', 'documents', 'underwriting', 'conditions', 'contracting']);
    await waitForEmail({ tenant: df.inst.bank.key, to: dealer.email, subject: /Approved: Jamie Rivera/, since });

    // Funding package from the dealer, audited by the funding team.
    const funding = await waitForRequest(me, kase.id, 'Funding package');
    const title = await uploadForRequest(me, { taskId: funding.id, itemKey: 'title', name: 'title-application.pdf', type: 'application/pdf', bytes: await documentPdf(['Application for Texas title', `VIN: ${deal.vin}`, 'Lienholder: the lender']) });
    const insurance = await uploadForRequest(me, { taskId: funding.id, itemKey: 'insurance', name: 'insurance.pdf', type: 'application/pdf', bytes: await documentPdf(['Proof of insurance', `Insured: ${deal.buyerName}`]) });
    expectStatus(await me.post(`/me/cases/${kase.id}/requests/${funding.id}/respond`, { response: { title: [title.outcome!.fileId], insurance: [insurance.outcome!.fileId] } }), 200);
    const audit = await decideDeal(df.funder, kase.id, 'fund', 'Package complete');
    expect(audit.title).toBe('Funding audit: Jamie Rivera · $21,000.00');

    // Funded: the dealer is paid in QuickBooks (their own "connector": a function of HTTP steps), the loan is boarded.
    const done = await waitForCase(df.inst.bank.adminApi, kase.id, (c) => c.status === 'approved', 90_000);
    expect(done).toMatchObject({ outcome: 'funded', stage: 'boarded' });
    expect(done.data).toMatchObject({ fundedAmount: 21_000 - DEALER_FEE });
    const company = await quickbooksCompany(df.realm);
    expect(company.vendors.map((v: any) => v.DisplayName)).toEqual(['Sunrise Motors']);
    expect(company.bills).toEqual([expect.objectContaining({ DocNumber: kase.reference, TotalAmt: 21_000 - DEALER_FEE })]);
    expect(company.payments).toEqual([expect.objectContaining({ TotalAmt: 21_000 - DEALER_FEE })]);
    const loan = (await loanproLoans()).find((l: any) => l.displayId === kase.reference);
    expect(loan).toMatchObject({ active: 1, LoanSetup: expect.objectContaining({ loanAmount: 21_000, loanRate: 8.9, loanTerm: 60 }), Collateral: expect.objectContaining({ vin: deal.vin, make: 'Honda' }) });
    expect(done.data.loanId).toBe(loan.id);
    expect((await dealLog(df.spreadsheetId)).filter((row) => row[1] === kase.reference).map((row) => row[6])).toEqual(['In underwriting', 'Funded']);
    await waitForEmail({ tenant: df.inst.bank.key, to: dealer.email, subject: /Funded: Jamie Rivera/, since });

    // The title: a workflow of its own (started without waiting), called back by the title service on its hook URL.
    const titleCase = await waitForTitleCase(kase.reference);
    expect(titleCase).toMatchObject({ status: 'in_progress', stage: 'waiting' });
    // The address to give the title service: only for whoever may signal anyway (cases:signal).
    await expect.poll(async () => ((await df.inst.bank.adminApi.get(`/cases/${titleCase.id}/signals`)).body as any[])[0]?.status, { timeout: 15_000 }).toBe('waiting');
    const hook = ((await df.inst.bank.adminApi.get(`/cases/${titleCase.id}/signals`)).body as any[])[0].hookUrl as string;
    expect(hook).toMatch(/\/hooks\/cases\//);
    expect(((await df.funder.get(`/cases/${titleCase.id}/signals`)).body as any[])[0]).not.toHaveProperty('hookUrl');
    const bad = await fetch(hook.replace(/token=[^&]+/, 'token=forged'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(bad.status).toBe(403);
    const called = await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titleNumber: 'TX-88213409', state: 'TX', lienholder: df.inst.bank.tenant.name }) });
    expect(called.status).toBe(202);
    const perfected = await waitForCase(df.inst.bank.adminApi, titleCase.id, (c) => c.status === 'completed', 30_000);
    expect(perfected).toMatchObject({ stage: 'perfected', outcome: 'lien_perfected', data: expect.objectContaining({ titleNumber: 'TX-88213409', titleState: 'TX' }) });

    // The buyer became a client of the institution, was invited, and sees their loan in the app.
    const invitation = await waitForEmail({ tenant: df.inst.bank.key, to: deal.buyerEmail, subject: /Your account with/, since });
    expect(invitation.text).toContain('Your auto loan for the 2022 Honda Accord is with us');
    const borrower = Api.as(await clientSignIn(df.inst.bank, deal.buyerEmail));
    expectStatus(await borrower.post('/me/app/consents', { consents: [{ key: 'terms', version: '2026-01' }, { key: 'privacy', version: '2026-01' }] }), [200, 201]);
    const mine = await data(borrower, ['me', 'records:loans', 'notifications', 'journeys']);
    expect(mine.me.segments).toEqual(['borrower']);
    expect(mine.records.loans).toEqual([expect.objectContaining({ key: kase.reference, balance: 21_000, payment: 434.91, vin: deal.vin, currency: 'USD' })]);
    expect(mine.notifications.map((n: any) => n.title)).toContain('Your auto loan is ready');
    expect(mine.journeys.map((j: any) => j.key)).toEqual(['make_payment', 'payoff', 'hardship']);
    // The dealer's deals are the dealer's: the borrower sees none of the dealer's case.
    expectStatus(await borrower.get(`/me/app/cases/${kase.id}/journey`), 404);

    // Servicing: the borrower pays in the app (posted in LoanPro), gets a receipt from the servicing workflow.
    let pay = await startJourney(borrower, 'make_payment');
    expect(pay.screen.values).toMatchObject({ loan: kase.reference, amount: 434.91 });
    let res = await submitScreen(borrower, pay, 'continue', { loan: kase.reference, amount: 500 });
    pay = res.body.screen?.stage === 'confirm' ? res.body : await waitForJourney(borrower, pay.case.id, (s) => s.screen?.stage === 'confirm');
    expect(pay.screen.content).toContain('**$500.00** towards your **Auto loan · 2022 Honda Accord**');
    res = await submitScreen(borrower, pay, 'pay', {});
    await waitForJourney(borrower, pay.case.id, (s) => s.state === 'done', 30_000);
    const afterPayment = await data(borrower, ['records:loans', 'records:payments']);
    expect(afterPayment.records.payments).toEqual([expect.objectContaining({ amount: 500, loan: kase.reference })]);
    expect(afterPayment.records.loans[0].balance).toBeLessThan(21_000);
    await expect.poll(async () => (await data(borrower, ['notifications'])).notifications.map((n: any) => n.title), { timeout: 30_000 }).toContain('Payment received: $500.00');

    // A missed payment in LoanPro: a reminder in the app and a collections call for the team.
    await loanproAction(loan.id, 'delinquent', { daysPastDue: 12 });
    await expect.poll(async () => (await data(borrower, ['notifications'])).notifications.map((n: any) => n.title), { timeout: 30_000 }).toContain('Your payment is past due');
    await expect.poll(async () => ((await staff.get('/tasks?view=queue')).body as any[]).map((t) => t.title), { timeout: 30_000 })
      .toContain(`Collections: ${kase.reference} is 12 days past due`);
    expect((await data(borrower, ['records:loans'])).records.loans[0]).toMatchObject({ daysPastDue: 12, status: 'Delinquent' });

    // Paid off from the app (payoff quote live from LoanPro): congratulations, and the lien release for the team.
    let payoff = await startJourney(borrower, 'payoff');
    expect(payoff.screen.title).toMatch(/^Payoff amount: \$[\d,]+\.\d\d$/);
    res = await submitScreen(borrower, payoff, 'pay', {});
    await waitForJourney(borrower, payoff.case.id, (s) => s.state === 'done', 30_000);
    await expect.poll(async () => (await data(borrower, ['me'])).me.segments, { timeout: 30_000 }).toContain('paid_off');
    await expect.poll(async () => ((await df.funder.get('/tasks?view=queue')).body as any[]).map((t) => t.title), { timeout: 30_000 })
      .toContain(`Release the lien for ${kase.reference}`);
    expect((await data(borrower, ['records:loans'])).records.loans[0]).toMatchObject({ balance: 0, status: 'Paid Off' });
  });

  test('flags from the documents reach the underwriter; a declined deal is logged and the dealer told why', async () => {
    const dealer = await dealerUser(df, 'Lakeside Auto');
    const me = Api.as(dealer);
    const deal = sampleDeal({ buyerName: 'Robin Hale', amountFinanced: 31_000, salePrice: 24_000, statedIncome: 6_000 });
    const since = Date.now() - 1000;
    const kase = await submitDeal(me, deal, await dealDocuments(deal, { income: 2_900, vin: '1HGCV1F30LA099999' }));
    const task = await waitForTask(df.underwriter, kase.id, { timeoutMs: 60_000 });
    expect(task.description).toContain('Flags: Payment-to-income above 20%; Loan-to-value above 120%; Declared income differs from the pay stub by 51.7%; VIN on the buyer order does not match');
    await decideDeal(df.underwriter, kase.id, 'decline', 'Income not supported by the pay stub');
    const done = await waitForCase(df.inst.bank.adminApi, kase.id, (c) => c.status === 'rejected', 30_000);
    expect(done).toMatchObject({ stage: 'declined', outcome: 'declined' });
    const mail = await waitForEmail({ tenant: df.inst.bank.key, to: dealer.email, subject: /Deal declined: Robin Hale/, since });
    expect(mail.text).toContain('Income not supported by the pay stub');
    expect((await dealLog(df.spreadsheetId)).filter((row) => row[1] === kase.reference).map((row) => row[6])).toEqual(['In underwriting', 'Declined']);
    expect(await emailsTo({ tenant: df.inst.bank.key, to: deal.buyerEmail, since })).toEqual([]);
  });

  test('a stipulation the AI cannot fully read is reported, and underwriting falls back to the declared figures', async () => {
    const dealer = await dealerUser(df, 'Valley Cars');
    const deal = sampleDeal({ buyerName: 'Sky Morgan' });
    const kase = await submitDeal(Api.as(dealer), deal, await dealDocuments(deal, { income: null }));
    const task = await waitForTask(df.underwriter, kase.id, { timeoutMs: 60_000 });
    expect(task.description).toContain('Pay stub (AI): Northwind Logistics, $—/month (declared $5,500.00)');
    const view = (await df.underwriter.get(`/cases/${kase.id}`)).body;
    const paystub = view.calculations.find((c: any) => c.step === 'read_paystub');
    expect(paystub.values).toMatchObject({ employer: 'Northwind Logistics', grossMonthlyIncome: null, missing: ['grossMonthlyIncome'] });
    expect(view.calculations.find((c: any) => c.step === 'numbers').values).toMatchObject({ income: 5_500, incomeGap: null });
  });
});

/** The dealer's open request on a case (information asked by the team, the funding package). */
async function waitForRequest(me: Api, caseId: string, title?: string) {
  let found: any;
  await expect.poll(async () => {
    const requests = (await me.post('/me/app/data', { sources: ['requests'] })).body.requests as any[];
    found = requests.find((r) => r.case?.id === caseId && r.status === 'open' && (!title || r.title === title));
    return !!found;
  }, { timeout: 60_000, message: `request ${title ?? ''} on ${caseId}` }).toBe(true);
  return found;
}

/** The title tracking case started by the deal (a workflow called without waiting). */
async function waitForTitleCase(reference: string) {
  let found: any;
  await expect.poll(async () => {
    const list = (await df.inst.bank.adminApi.get(`/cases?search=${encodeURIComponent(reference)}`)).body;
    const rows = (Array.isArray(list) ? list : list.items ?? list.cases ?? []) as any[];
    const row = rows.find((c) => String(c.title).startsWith('Title:'));
    if (row) found = (await df.inst.bank.adminApi.get(`/cases/${row.id}`)).body;
    return !!found && found.stage === 'waiting';
  }, { timeout: 30_000, message: `title case of ${reference}` }).toBe(true);
  return found;
}
