import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { decide, prepareInstitution, waitForTask, type Institution } from '../../support/scenario';
import { pdfBytes, uploadForRequest } from '../../support/uploads';
import { bankingCustomer, installBankingApp, startJourney, submitScreen, systemApi, waitForJourney } from '../../support/client-app';

/** Every journey of the banking template, through the client API, including the team's checks. */
test.describe.configure({ timeout: 150_000 });

let inst: Institution;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  await installBankingApp(Api.as(inst.members.designer));
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const start = startJourney;

/** Press a button, then wait until the journey shows what `until` expects. */
async function press(me: Api, state: any, event: string, values: Record<string, unknown>, until: (s: any) => boolean) {
  const res = await submitScreen(me, state, event, values);
  expectStatus(res, [200, 201]);
  return until(res.body) ? res.body : waitForJourney(me, state.case.id, until);
}

const data = async (me: Api, sources: string[]) => (await me.post('/me/app/data', { sources })).body;

/** The reviewer claims the journey's task and decides it. */
async function review(caseId: string, decision: string, reason: string) {
  const analyst = Api.as(inst.members.analyst);
  const task = await waitForTask(analyst, caseId);
  expectStatus(await analyst.post(`/tasks/${task.id}/claim`), 200);
  expectStatus(await decide(analyst, task.id, decision as 'approve', reason), [200, 201]);
  return task;
}

test.describe('APP-04 Banking journeys', { tag: ['@client', '@APP-04'] }, () => {
  test('open a savings account: product, first deposit (more than available → branch), terms, the new account', async () => {
    const casey = await bankingCustomer(inst.bank, system, { current: 900 });
    const me = Api.as(casey.session);
    let state = await start(me, 'open_savings');
    expect(state.screen.fields[0]).toMatchObject({ key: 'product', type: 'choice' });
    state = await press(me, state, 'continue', { product: '1-Year Fixed Saver · 4.20% AER · fixed for 12 months', nickname: 'House deposit' }, (s) => s.screen?.stage === 'fund');
    state = await press(me, state, 'continue', { fromAccount: 'cur-1', deposit: 5000 }, (s) => s.screen?.title === 'That is more than you have available');
    state = await press(me, state, 'back', {}, (s) => s.screen?.stage === 'fund' && s.screen?.fields.length > 0);
    state = await press(me, state, 'continue', { fromAccount: 'cur-1', deposit: 400 }, (s) => s.screen?.stage === 'confirm');
    expect(state.screen.content).toContain('First deposit of **£400.00** from your **Everyday account**');
    expectStatus(await submitScreen(me, state, 'open', {}), 422); // the terms
    state = await press(me, state, 'open', { terms: true }, (s) => s.state === 'done');
    expect(state.message.title).toBe('Your savings account is open');

    const after = await data(me, ['records:accounts', 'notifications']);
    const saver = after.records.accounts.find((a: any) => a.name === 'House deposit');
    expect(saver).toMatchObject({ type: 'savings', balance: 400, rate: 4.2, status: 'active' });
    expect(after.records.accounts.find((a: any) => a.key === 'cur-1').balance).toBe(500);
    expect(after.notifications[0].link).toMatchObject({ page: 'account', params: { key: saver.key } });
  });

  test('personal loans: an instant offer for a small loan, a credit review above 10,000, a refusal when not affordable', async () => {
    const casey = await bankingCustomer(inst.bank, system, { current: 100 });
    const me = Api.as(casey.session);

    // 5,000 over 2 years: offer, accepted, paid out at once.
    let state = await start(me, 'personal_loan');
    expect(state.screen.fields.find((f: any) => f.key === 'term').options).toContainEqual({ value: '24', label: '2 years' });
    const tooSmall = await submitScreen(me, state, 'continue', { amount: 500, term: '24', purpose: 'A car', payTo: 'cur-1' });
    expectStatus(tooSmall, 422);
    expect(tooSmall.body.errors).toEqual([{ field: 'amount', message: 'Amount: at least 1000' }]);
    state = await press(me, state, 'continue', { amount: 5000, term: '24', purpose: 'A car', payTo: 'cur-1' }, (s) => s.screen?.stage === 'finances');
    state = await press(me, state, 'continue', { employment: 'Employed full-time', income: 42000, outgoings: 900 }, (s) => s.screen?.stage === 'offer');
    expect(state.screen.content).toContain('**£5,000.00** over **24 months**');
    state = await press(me, state, 'accept', { agree: true }, (s) => s.state === 'done');
    expect(state).toMatchObject({ case: { status: 'approved', outcome: 'loan_paid_out' }, message: { title: 'Your loan is paid out' } });
    let accounts = (await data(me, ['records:accounts'])).records.accounts;
    expect(accounts.find((a: any) => a.key === 'cur-1').balance).toBe(5100);
    expect(accounts.find((a: any) => a.type === 'loan')).toMatchObject({ balance: -5000, termMonths: 24 });

    // 20,000: the credit analyst reviews it first.
    state = await start(me, 'personal_loan');
    state = await press(me, state, 'continue', { amount: 20000, term: '60', purpose: 'Home improvements', payTo: 'cur-1' }, (s) => s.screen?.stage === 'finances');
    state = await press(me, state, 'continue', { employment: 'Employed full-time', income: 90000, outgoings: 1200 }, (s) => s.screen?.stage === 'offer');
    state = await press(me, state, 'accept', { agree: true }, (s) => s.state === 'waiting');
    const task = await review(state.case.id, 'approve', 'Income verified');
    expect(task.title).toContain('£20,000.00 over 60 months');
    state = await waitForJourney(me, state.case.id, (s) => s.state === 'done');
    expect(state.case.status).toBe('approved');
    accounts = (await data(me, ['records:accounts'])).records.accounts;
    expect(accounts.find((a: any) => a.key === 'cur-1').balance).toBe(25100);

    // Not affordable: refused with an explanation, no money moves.
    state = await start(me, 'personal_loan');
    state = await press(me, state, 'continue', { amount: 50000, term: '12', purpose: 'Something else', payTo: 'cur-1' }, (s) => s.screen?.stage === 'finances');
    state = await press(me, state, 'continue', { employment: 'Other', income: 12000, outgoings: 800 }, (s) => s.state === 'done');
    expect(state).toMatchObject({ case: { status: 'rejected', outcome: 'not_affordable' }, message: { title: "We can't offer this loan right now" } });
  });

  test('report a lost card: the card is blocked and a new one ordered to the confirmed address', async () => {
    const casey = await bankingCustomer(inst.bank, system);
    const me = Api.as(casey.session);
    expectStatus(await system.patch(`/clients/ext:${casey.externalId}/profile`, { attributes: { address: '9 Quay Road, Hull' } }), 200);
    let state = await start(me, 'report_lost', { card: 'card-1' });
    expect(state.screen).toMatchObject({ title: 'Report your card ending 4242', values: { deliver: '9 Quay Road, Hull' } });
    state = await press(me, state, 'block', { what: 'It was stolen', deliver: '9 Quay Road, Hull' }, (s) => s.state === 'done');
    expect(state.message.title).toBe('Your new card is on its way');
    const cards = (await data(me, ['records:cards'])).records.cards;
    expect(cards.find((c: any) => c.key === 'card-1')).toMatchObject({ status: 'blocked', blockedReason: 'It was stolen' });
    expect(cards.find((c: any) => c.key !== 'card-1')).toMatchObject({ status: 'ordered', network: 'visa', type: 'debit' });
  });
});

test.describe('APP-05 Journeys checked by the team', { tag: ['@client', '@reviewer', '@APP-05'] }, () => {
  test('change of address: proof of address, the team accepts, the profile changes', async () => {
    const casey = await bankingCustomer(inst.bank, system);
    const me = Api.as(casey.session);
    let state = await start(me, 'update_address');
    const upload = await uploadForRequest(me, { taskId: state.screen.taskId, itemKey: 'proof', name: 'bill.pdf', type: 'application/pdf', bytes: await pdfBytes('Energy bill — 3 Mill Lane') });
    state = await press(me, state, 'continue', { newAddress: '3 Mill Lane, York', movedOn: '2026-10-01', proof: [upload.outcome!.fileId] }, (s) => s.state === 'waiting');
    await review(state.case.id, 'accept', 'Bill matches');
    state = await waitForJourney(me, state.case.id, (s) => s.state === 'done');
    expect(state.message.title).toBe('Address updated');
    expect((await data(me, ['me'])).me.address).toBe('3 Mill Lane, York');
    // The team sees the proof on the case.
    const kase = await Api.as(inst.bank.admin).get(`/cases/${state.case.id}`);
    expect(JSON.stringify(kase.body)).toContain('bill.pdf');
  });

  test('a secure message is answered by the team in the app', async () => {
    const casey = await bankingCustomer(inst.bank, system);
    const me = Api.as(casey.session);
    let state = await start(me, 'contact_us');
    state = await press(me, state, 'send', { topic: 'Cards', message: 'Can I raise my contactless limit?' }, (s) => s.state === 'waiting');
    const task = await review(state.case.id, 'answered', 'Yes — Cards → Limits in the app, up to £100.');
    expect(task.description).toBe('Can I raise my contactless limit?');
    state = await waitForJourney(me, state.case.id, (s) => s.state === 'done');
    expect(state.message).toMatchObject({ title: 'We answered your message about Cards', body: 'Yes — Cards → Limits in the app, up to £100.' });
  });
});
