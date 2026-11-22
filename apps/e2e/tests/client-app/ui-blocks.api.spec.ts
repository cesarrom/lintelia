import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { deleteTenant } from '../../support/factories';
import { prepareInstitution, type Institution } from '../../support/scenario';
import { appClient, bankingCustomer, installBankingApp, startJourney, submitScreen, systemApi, waitForJourney } from '../../support/client-app';
import { emvPayload } from '../../support/payment-codes';
import { publishWorkflow, screenBlocksWorkflowYaml } from '../../support/workflows';

/**
 * APP-12 UI building blocks (docs/plans/14), as the API enforces them: a scanned payment code is read again by the API
 * (`<key>Details` for the next steps), fields shown on a condition are only required when shown, one-time codes,
 * sliders, format rules (IBAN, patterns) and calculated values.
 */
test.describe.configure({ timeout: 150_000 });

let inst: Institution;
let system: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer' } });
  await installBankingApp(Api.as(inst.members.designer));
  system = await systemApi(inst.bank, ['clients:provision', 'clients:records']);
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const until = (me: Api, state: any, predicate: (s: any) => boolean) => (predicate(state) ? state : waitForJourney(me, state.case.id, predicate));

test.describe('APP-12 Pay with a QR code: the API reads the code again', { tag: ['@client', '@APP-12'] }, () => {
  test('damaged codes are refused, the amount is asked only when the code has none, other currencies and too-high amounts stop, the payment is recorded', async () => {
    const casey = await bankingCustomer(inst.bank, system, { name: 'Casey Customer', current: 1000 });
    const me = Api.as(casey.session);
    let state = await startJourney(me, 'pay_qr');
    expect(state.screen).toMatchObject({
      title: 'Scan to pay',
      autoSubmit: { button: 'continue', when: 'expression', delay: 2 },
      fields: expect.arrayContaining([
        expect.objectContaining({ key: 'code', type: 'scan', parse: 'emv', scanCodes: 'qr' }),
        expect.objectContaining({ key: 'amount', type: 'money', visibleIf: expect.stringContaining('codeDetails') }),
        expect.objectContaining({ key: 'note', width: 'half' }),
      ]),
    });

    // A damaged code (its checksum no longer matches) is refused with the reason.
    const withAmount = emvPayload({ payee: 'Corner Cafe', city: 'London', account: 'SHOP-42', amount: 12.5, reference: 'T-881' });
    const damaged = await submitScreen(me, state, 'continue', { code: withAmount.replace('Corner', 'Korner') });
    expectStatus(damaged, 422);
    expect(damaged.body.errors).toEqual([expect.objectContaining({ field: 'code', message: expect.stringContaining('checksum') })]);

    // A code without an amount: the amount field shows, so it is required.
    const open = emvPayload({ payee: 'Market Stall', city: 'Bristol', account: 'STALL-7' });
    const noAmount = await submitScreen(me, state, 'continue', { code: open });
    expectStatus(noAmount, 422);
    expect(noAmount.body.errors).toEqual([expect.objectContaining({ field: 'amount' })]);

    // A code with its amount: the amount typed (hidden field) is ignored, the code's wins.
    state = (await submitScreen(me, state, 'continue', { code: withAmount, amount: 999 })).body;
    state = await until(me, state, (s) => s.screen?.stage === 'confirm');
    expect(state.screen.title).toBe('Pay Corner Cafe');
    expect(state.screen.content).toContain('**£12.50** to **Corner Cafe**, London');

    // Another currency: the workflow explains, the client scans another code.
    state = (await submitScreen(me, state, 'back')).body;
    state = await until(me, state, (s) => s.screen?.title === 'Scan to pay');
    state = (await submitScreen(me, state, 'continue', { code: emvPayload({ payee: 'NYC Deli', city: 'New York', account: 'DELI', amount: 5, currency: 'USD', country: 'US' }) })).body;
    state = await until(me, state, (s) => s.screen?.title === "We can't make this payment");
    expect(state.screen.content).toContain('asks for a payment in USD');
    state = (await submitScreen(me, state, 'again')).body;
    state = await until(me, state, (s) => s.screen?.title === 'Scan to pay');

    // More than the balance.
    state = (await submitScreen(me, state, 'continue', { code: open, amount: 5000 })).body;
    state = await until(me, state, (s) => s.screen?.title === "We can't make this payment");
    expect(state.screen.content).toContain('more than the £1,000.00 in your Everyday account');
    state = (await submitScreen(me, state, 'again')).body;
    state = await until(me, state, (s) => s.screen?.title === 'Scan to pay');

    // The amount typed, a note and a category; pay.
    state = (await submitScreen(me, state, 'continue', { code: open, amount: 40, note: 'Flowers', category: 'Shopping' })).body;
    state = await until(me, state, (s) => s.screen?.stage === 'confirm');
    expect(state.screen.content).toContain('**£40.00** to **Market Stall**, Bristol');
    state = (await submitScreen(me, state, 'pay')).body;
    state = await until(me, state, (s) => s.state === 'done');
    expect(state).toMatchObject({ case: { status: 'completed', outcome: 'paid' }, message: { title: 'Paid Market Stall', body: '£40.00 from your Everyday account.' } });

    const data = (await me.post('/me/app/data', { sources: ['records:accounts', 'records:transactions'] })).body;
    expect(data.records.accounts.find((a: any) => a.key === 'cur-1').balance).toBe(960);
    expect(data.records.transactions.find((t: any) => t.channel === 'qr')).toMatchObject({ description: 'Market Stall · Flowers', amount: -40, category: 'Shopping' });

    // What the code said is in the case, for the back office and later steps.
    const kase = (await Api.as(inst.bank.admin).get(`/cases/${state.case.id}`)).body;
    expect(kase.data.codeDetails).toMatchObject({ format: 'emv', valid: true, payee: 'Market Stall', city: 'Bristol', account: 'STALL-7', currency: 'GBP' });
  });
});

test.describe('APP-12 Screen fields: one-time codes, sliders, format rules, conditional and calculated fields', { tag: ['@client', '@flow-designer', '@APP-12'] }, () => {
  test('the API checks each field like the app does; hidden and calculated fields are not kept', async () => {
    const designer = Api.as(inst.members.designer);
    const workflowId = await publishWorkflow(designer, screenBlocksWorkflowYaml(`Screen blocks ${Date.now()}`));
    const app = (await designer.get('/client-apps/current')).body;
    const draft = structuredClone(app.draft);
    draft.journeys.blocks = { workflowId, title: 'Blocks', inputs: [], stages: [], presentation: { mode: 'dialog', size: 'lg' } };
    expectStatus(await designer.put('/client-apps/current/draft', { definition: draft }), 200);
    expectStatus(await designer.post('/client-apps/current/publish'), 200);

    const me = Api.as(await appClient(inst.bank, { name: 'Fiona Fields' }));
    expect((await me.get('/me/app')).body.definition.journeys.blocks.presentation).toEqual({ mode: 'dialog', size: 'lg' });
    let state = await startJourney(me, 'blocks');
    expect(state.screen.fields.map((f: any) => f.type)).toEqual(['slider', 'display', 'text', 'text', 'text', 'otp', 'signature']);

    const wrong = await submitScreen(me, state, 'continue', { months: 72, iban: 'GB00 WEST 1234 5698 7654 32', ref: 'abc', code: '12a45' });
    expectStatus(wrong, 422);
    const errors = Object.fromEntries((wrong.body.errors as any[]).map((e) => [e.field, e.message]));
    expect(errors).toMatchObject({
      months: expect.stringContaining('at most 60'),
      iban: expect.stringContaining('valid IBAN'),
      ref: expect.stringContaining('like ABC-123'),
      code: expect.stringContaining('6 digits'),
    });
    // Shown (more than 36 months) means required.
    expect(errors.reason).toContain('required');

    // 24 months: the reason is hidden (ignored if sent), the calculated value is never sent back.
    state = (await submitScreen(me, state, 'continue', { months: 24, monthly: 1, reason: 'ignored', iban: 'GB82 WEST 1234 5698 7654 32', ref: 'ABC-123', code: '123 456' })).body;
    state = await until(me, state, (s) => s.state === 'done');
    const kase = (await Api.as(inst.bank.admin).get(`/cases/${state.case.id}`)).body;
    expect(kase.data).toMatchObject({ months: 24, iban: 'GB82 WEST 1234 5698 7654 32', ref: 'ABC-123', code: '123456' });
    expect(kase.data.reason).toBeUndefined();
    expect(kase.data.monthly).toBeUndefined();
  });

  test('mistakes in the new options are refused when the workflow is saved', async () => {
    const designer = Api.as(inst.members.designer);
    const broken = screenBlocksWorkflowYaml(`Broken blocks ${Date.now()}`)
      .replace('visibleIf: "months > 36"', 'visibleIf: "months >"')
      .replace('buttons: [{ key: continue', 'autoSubmit: { button: pay, when: complete }\n      buttons: [{ key: continue');
    const created = await designer.post('/workflows', { yaml: broken });
    const published = created.status < 300 ? await designer.post(`/workflows/${created.body.id}/publish`) : created;
    expect(published.status).toBeGreaterThanOrEqual(400);
    const text = JSON.stringify(published.body);
    expect(text).toContain('reason');
    expect(text).toContain('\\"pay\\", which is not one of its buttons');
  });
});
