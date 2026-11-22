import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { decide, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { pdfBytes, uploadForRequest } from '../../support/uploads';
import { appClient, bankingCustomer, installBankingApp, startJourney, submitScreen, systemApi, waitForJourney } from '../../support/client-app';

test.describe.configure({ timeout: 150_000 });

let inst: Institution;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer' } });
  await installBankingApp(Api.as(inst.members.designer));
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

test.describe('APP-03 Clients read their own data, only what the app declares', { tag: ['@client', '@APP-03', '@CLI-11'] }, () => {
  test('the page data is resolved for the signed-in client; undeclared sources are refused', async () => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Casey Customer', current: 1500 });
    const other = await bankingCustomer(inst.bank, system, { name: 'Olive Other', current: 99 });
    const me = Api.as(casey.session);
    const data = await me.post('/me/app/data', { sources: ['me', 'records:accounts', 'records:cards', 'journeys', 'notifications'] });
    expectStatus(data, 200);
    expect(data.body.me).toMatchObject({ name: 'Casey Customer', firstName: 'Casey', externalId: casey.externalId, segments: expect.arrayContaining(['customer']) });
    expect(data.body.records.accounts.map((a: any) => [a.key, a.balance])).toEqual(expect.arrayContaining([['cur-1', 1500], ['sav-1', 500]]));
    expect(JSON.stringify(data.body)).not.toContain(other.externalId);
    // Eligibility applies to the journeys offered: a customer is not offered to open a first account.
    const journeys = (data.body.journeys as any[]).map((j) => j.key);
    expect(journeys).toEqual(expect.arrayContaining(['transfer', 'open_savings', 'personal_loan']));
    expect(journeys).not.toContain('open_current');
    expect(journeys).not.toContain('card_freeze'); // started by buttons only

    expectForbidden(await me.post('/me/app/data', { sources: ['records:secrets'] }));
    // Members are not clients: the client API is not theirs.
    expectForbidden(await Api.as(inst.members.analyst).post('/me/app/data', { sources: ['me'] }));
  });
});

test.describe('APP-04 Run a journey: screens, checks, branching, records and messages', { tag: ['@client', '@APP-04'] }, () => {
  test('moving money: field errors, an impossible amount, the confirmation, balances and transactions updated', async () => {
    const casey = await bankingCustomer(inst.bank, system, { current: 1000, savings: 200 });
    const me = Api.as(casey.session);
    let state = await startJourney(me, 'transfer');
    expect(state).toMatchObject({ state: 'screen', journey: { key: 'transfer' }, stages: [{ key: 'details', status: 'current' }, { key: 'confirm', status: 'todo' }] });
    expect(state.screen.fields.find((f: any) => f.key === 'fromAccount').options).toEqual(expect.arrayContaining([{ value: 'cur-1', label: 'Everyday account · £1,000.00' }]));

    const invalid = await submitScreen(me, state, 'continue', { fromAccount: 'cur-1' });
    expectStatus(invalid, 422);
    expect(invalid.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'toAccount' }), expect.objectContaining({ field: 'amount' })]));
    const unknownOption = await submitScreen(me, state, 'continue', { fromAccount: 'cur-999', toAccount: 'sav-1', amount: 5 });
    expectStatus(unknownOption, 422);

    // More than the balance: the workflow branches to a "not possible" screen.
    state = (await submitScreen(me, state, 'continue', { fromAccount: 'cur-1', toAccount: 'sav-1', amount: 5000 })).body;
    state = state.screen?.title === "We can't make this transfer" ? state : await waitForJourney(me, state.case.id, (s) => s.screen?.title === "We can't make this transfer");
    expect(state.screen.content).toContain('£1,000.00 available in your Everyday account');
    state = (await submitScreen(me, state, 'back')).body;
    state = state.screen?.fields?.length ? state : await waitForJourney(me, state.case.id, (s) => s.screen?.fields?.length > 0);
    expect(state.screen.values).toMatchObject({ fromAccount: 'cur-1', toAccount: 'sav-1', amount: 5000 });

    state = (await submitScreen(me, state, 'continue', { fromAccount: 'cur-1', toAccount: 'sav-1', amount: 250.5, reference: 'Holiday' })).body;
    state = state.screen?.stage === 'confirm' ? state : await waitForJourney(me, state.case.id, (s) => s.screen?.stage === 'confirm');
    expect(state.screen.content).toContain('£250.50');
    expect(state.stages.map((s: any) => s.status)).toEqual(['done', 'current']);
    state = (await submitScreen(me, state, 'move')).body;
    state = state.state === 'done' ? state : await waitForJourney(me, state.case.id, (s) => s.state === 'done');
    expect(state).toMatchObject({ case: { status: 'completed', outcome: 'transferred' }, message: { title: 'Money moved', body: '£250.50 is now in your Rainy day saver.' } });

    const data = (await me.post('/me/app/data', { sources: ['records:accounts', 'records:transactions', 'notifications', 'cases'] })).body;
    expect(Object.fromEntries(data.records.accounts.map((a: any) => [a.key, a.balance]))).toEqual({ 'cur-1': 749.5, 'sav-1': 450.5 });
    expect(data.records.transactions.filter((t: any) => t.category === 'Transfers').map((t: any) => t.amount).sort()).toEqual([-250.5, 250.5]);
    expect(data.notifications[0]).toMatchObject({ title: 'Money moved', read: false });
    expect(data.cases[0]).toMatchObject({ journey: 'transfer', title: 'Move money', status: 'completed', final: true });

    // The back office sees the case like any other, started from the app.
    const kase = await Api.as(inst.bank.admin).get(`/cases/${state.case.id}`);
    expectStatus(kase, 200);
    expect(kase.body.source).toBe('client:transfer');
  });

  test('one-tap journeys take their input from the button: freezing and unfreezing a card', async () => {
    const casey = await bankingCustomer(inst.bank, system);
    const me = Api.as(casey.session);
    const started = await startJourney(me, 'card_freeze', { card: 'card-1', injected: 'ignored' });
    const done = started.state === 'done' ? started : await waitForJourney(me, started.case.id, (s) => s.state === 'done');
    expect(done.message.title).toBe('Card frozen');
    let cards = (await me.post('/me/app/data', { sources: ['records:cards'] })).body.records.cards;
    expect(cards[0]).toMatchObject({ key: 'card-1', status: 'frozen' });
    const kase = (await Api.as(inst.bank.admin).get(`/cases/${done.case.id}`)).body;
    expect(kase.data.injected).toBeUndefined();

    const again = await startJourney(me, 'card_freeze', { card: 'card-1' });
    if (again.state !== 'done') await waitForJourney(me, again.case.id, (s) => s.state === 'done');
    cards = (await me.post('/me/app/data', { sources: ['records:cards'] })).body.records.cards;
    expect(cards[0].status).toBe('active');
  });

  test('eligibility is checked by the API; screens of others cannot be answered', async () => {
    const newcomer = Api.as(await appClient(inst.bank, { name: 'New Comer' }));
    expectForbidden(await newcomer.post('/me/app/journeys/transfer/start', {}));
    expectStatus(await newcomer.post('/me/app/journeys/no_such_journey/start', {}), 404);

    const casey = await bankingCustomer(inst.bank, system);
    const started = await startJourney(Api.as(casey.session), 'transfer');
    expectStatus(await newcomer.get(`/me/app/cases/${started.case.id}/journey`), 404);
    expectStatus(await submitScreen(newcomer, started, 'continue', { fromAccount: 'cur-1', toAccount: 'sav-1', amount: 1 }), 404);
    // Nor through the generic request API.
    expectStatus(await Api.as(casey.session).post(`/me/requests/${started.screen.taskId}/respond`, { response: {} }), 409);
  });
});

test.describe('APP-05 Onboarding from the app: details, identity document, the team\'s check', { tag: ['@client', '@reviewer', '@APP-05'] }, () => {
  test('a newcomer opens an account: the reviewer approves and the client becomes a customer with an account and a card', async () => {
    const client = await appClient(inst.bank, { name: 'Nina Newcomer' });
    const me = Api.as(client);
    const offered = (await me.post('/me/app/data', { sources: ['journeys'] })).body.journeys.map((j: any) => j.key);
    expect(offered).toContain('open_current');

    let state = await startJourney(me, 'open_current');
    expect(state.screen.values.fullName).toBe('Nina Newcomer');
    state = (await submitScreen(me, state, 'continue', { fullName: 'Nina Newcomer', dateOfBirth: '1994-02-03', phone: '+44 7700 900111', address: '1 High Street, Leeds', employment: 'Self-employed' })).body;
    state = state.screen?.stage === 'identity' ? state : await waitForJourney(me, state.case.id, (s) => s.screen?.stage === 'identity');
    expect(state.screen.fields.map((f: any) => f.type)).toEqual(['file', 'checkbox']);

    const missing = await submitScreen(me, state, 'continue', { declaration: true });
    expectStatus(missing, 422);
    const upload = await uploadForRequest(me, { taskId: state.screen.taskId, itemKey: 'idDocument', name: 'passport.pdf', type: 'application/pdf', bytes: await pdfBytes('Passport — Nina Newcomer') });
    expect(upload.outcome?.status).toBe('available');
    state = (await submitScreen(me, state, 'continue', { idDocument: [upload.outcome!.fileId], declaration: true })).body;
    state = state.state === 'waiting' ? state : await waitForJourney(me, state.case.id, (s) => s.state === 'waiting');
    expect(state.stages.find((s: any) => s.key === 'review').status).toBe('current');

    const analyst = Api.as(inst.members.analyst);
    const task = await waitForTask(analyst, state.case.id);
    expect(task.title).toContain('KYC review: Nina Newcomer');
    expectStatus(await analyst.post(`/tasks/${task.id}/claim`), [200, 201]);
    expectStatus(await decide(analyst, task.id, 'approve', 'ID matches'), [200, 201]);
    await waitForCase(Api.as(inst.bank.admin), state.case.id, (k) => k.status === 'approved');

    const done = await waitForJourney(me, state.case.id, (s) => s.state === 'done');
    expect(done.message.title).toBe('Your account is open');
    const data = (await me.post('/me/app/data', { sources: ['me', 'records:accounts', 'records:cards', 'journeys'] })).body;
    expect(data.me.segments).toEqual(expect.arrayContaining(['customer']));
    expect(data.me).toMatchObject({ phone: '+44 7700 900111', employment: 'Self-employed', kycLevel: 2 });
    expect(data.records.accounts).toEqual([expect.objectContaining({ name: 'Everyday account', type: 'current', balance: 0, status: 'active' })]);
    expect(data.records.cards).toEqual([expect.objectContaining({ type: 'debit', status: 'ordered', holder: 'Nina Newcomer' })]);
    // Now a customer: other journeys open up, onboarding does not.
    const keys = data.journeys.map((j: any) => j.key);
    expect(keys).toContain('transfer');
    expect(keys).not.toContain('open_current');
  });
});
