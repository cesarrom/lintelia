import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { addClient, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { waitForCase } from '../../support/scenario';
import { publishWorkflow } from '../../support/workflows';

/**
 * Data from outside reaching running workflows (docs/plans/17 §3): events name what they are about (a loan), not a
 * case; the cases waiting for that value get them (AUT-08) — early ones kept when the step asks for it, duplicates
 * ignored, a work queue when one case only may take it; one case per loan receives every payment (AUT-09,
 * start-or-deliver); a workflow polls a system until a condition holds (AUT-10).
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

let bank: TenantHandle;
let system: Api;
let stamp: string;

test.beforeAll(async () => {
  bank = await createTenant();
  stamp = Date.now().toString(36);
  const client = await bank.adminApi.post('/api-clients', { name: 'Core banking', permissions: ['events:publish', 'cases:read'] });
  expectStatus(client, 201);
  const token = await Api.anonymous().post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: client.body.clientId, client_secret: client.body.clientSecret }));
  expectStatus(token, 200);
  system = Api.withToken(token.body.access_token, bank.key);
});
test.afterAll(async () => { await deleteTenant(bank); });

const decision = (id: string, status = 'completed') => `  - { id: ${id}, name: ${id}, type: case.decision, config: { status: ${status}, notifyApplicant: false }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }`;

/** Waits for a payment of its loan (`buffer`: also one received up to a minute before). */
const servicingYaml = (name: string, options: { buffer?: boolean } = {}) => `schemaVersion: "1"
name: "${name}"
description: waits for a payment of its loan
correlation:
  loan: "= input.loanId"
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [wait] }] }
  - id: wait
    name: Wait for the payment
    type: event.wait
    config: { event: "api:loan.payment", match: { loan: "= data.loanId" }, filter: "data.amount > 0", timeout: PT90S${options.buffer ? ', buffer: PT1M' : ''} }
    events: [{ name: received, outputs: [], next: [save] }, { name: timeout, outputs: [], next: [late] }]
  - { id: save, name: Save, type: case.update, config: { data: { paid: "= steps.wait.amount", eventId: "= steps.wait.event.id", source: "= steps.wait.event.source" } }, events: [{ name: done, outputs: [], next: [paid] }] }
${decision('paid')}
${decision('late', 'expired')}
`;

const start = async (workflowId: string, inputs: Record<string, unknown>) => {
  const res = await bank.adminApi.post('/cases', { workflowId, inputs });
  expectStatus(res, 201);
  return res.body as { id: string; reference: string };
};
const waits = async (caseId: string) => (await bank.adminApi.get(`/cases/${caseId}/signals`)).body as Array<{ kind: string; name: string; status: string; keys: Record<string, string> }>;
const waiting = (caseId: string) => expect.poll(async () => (await waits(caseId)).find((w) => w.kind === 'event')?.status, { timeout: 20_000 }).toBe('waiting');
const publish = (id: string, type: string, data: Record<string, unknown>) => system.post('/events', { id: `${stamp}-${id}`, type, data });

test.describe('AUT-08 An event reaches the cases waiting for what it is about', { tag: ['@integrations', '@AUT-08'] }, () => {
  let workflowId: string;

  test('only the case of that loan gets the payment; the filter applies; the same event twice is one event', async () => {
    workflowId = await publishWorkflow(bank.adminApi, servicingYaml('Loan servicing'));
    const first = await start(workflowId, { loanId: `L1-${stamp}` });
    const second = await start(workflowId, { loanId: `L2-${stamp}` });
    await waiting(first.id);
    await waiting(second.id);
    expect((await waits(first.id)).find((w) => w.kind === 'event')).toMatchObject({ name: 'api:loan.payment', keys: { loan: `L1-${stamp}` } });

    const paid = await publish('p1', 'loan.payment', { loanId: `L1-${stamp}`, amount: 120 });
    expectStatus(paid, 202);
    expect(paid.body).toMatchObject({ duplicate: false, event: 'api:loan.payment', delivered: [{ id: first.id, reference: first.reference, waiting: true }], started: [] });
    const done = await waitForCase(bank.adminApi, first.id, (c) => c.status === 'completed');
    expect(done.data).toMatchObject({ paid: 120, eventId: paid.body.eventId, source: expect.stringMatching(/^api:/) });
    expect((await publish('p1', 'loan.payment', { loanId: `L1-${stamp}`, amount: 120 })).body).toMatchObject({ duplicate: true, delivered: [], started: [] });

    // Not for this case (the filter), then for it.
    expect((await publish('p2', 'loan.payment', { loanId: `L2-${stamp}`, amount: 0 })).body.delivered).toEqual([]);
    expect((await waits(second.id)).find((w) => w.kind === 'event')?.status).toBe('waiting');
    expect((await publish('p3', 'loan.payment', { loanId: `L2-${stamp}`, amount: 45.5 })).body.delivered).toEqual([expect.objectContaining({ id: second.id })]);
    expect((await waitForCase(bank.adminApi, second.id, (c) => c.status === 'completed')).data.paid).toBe(45.5);
  });

  test('an event that arrived just before the case waited: kept when the step accepts earlier events, ignored otherwise', async () => {
    const buffered = await publishWorkflow(bank.adminApi, servicingYaml('Loan servicing (accepts earlier events)', { buffer: true }));
    expect((await publish('early-3', 'loan.payment', { loanId: `L3-${stamp}`, amount: 80 })).body).toMatchObject({ delivered: [], started: [] });
    const third = await start(buffered, { loanId: `L3-${stamp}` });
    expect((await waitForCase(bank.adminApi, third.id, (c) => c.status === 'completed')).data.paid).toBe(80);

    expect((await publish('early-4', 'loan.payment', { loanId: `L4-${stamp}`, amount: 80 })).body.delivered).toEqual([]);
    const fourth = await start(workflowId, { loanId: `L4-${stamp}` });
    await waiting(fourth.id);
    await new Promise((r) => setTimeout(r, 1500));
    expect((await bank.adminApi.get(`/cases/${fourth.id}`)).body.status).toBe('in_progress');
  });

  test('a work queue: of two cases waiting, one takes the job', async () => {
    const queue = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Picker"
description: takes one job
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [wait] }] }
  - { id: wait, name: Take a job, type: event.wait, config: { event: "api:job.ready", consume: true, timeout: PT90S }, events: [{ name: received, outputs: [], next: [save] }, { name: timeout, outputs: [], next: [idle] }] }
  - { id: save, name: Save, type: case.update, config: { data: { job: "= steps.wait.job" } }, events: [{ name: done, outputs: [], next: [took] }] }
${decision('took')}
${decision('idle', 'expired')}
`);
    const a = await start(queue, {});
    const b = await start(queue, {});
    await waiting(a.id);
    await waiting(b.id);
    const routed = await publish('job-1', 'job.ready', { job: 'J-1' });
    expect(routed.body.delivered).toHaveLength(1);
    expect(routed.body.delivered[0].id).toBe(a.id);
    await waitForCase(bank.adminApi, a.id, (c) => c.status === 'completed');
    expect((await bank.adminApi.get(`/cases/${b.id}`)).body.status).toBe('in_progress');
    expect((await publish('job-2', 'job.ready', { job: 'J-2' })).body.delivered).toEqual([expect.objectContaining({ id: b.id })]);
    expect((await waitForCase(bank.adminApi, b.id, (c) => c.status === 'completed')).data.job).toBe('J-2');
  });

  test('a platform event about the applicant: flagging a client reaches the case waiting for it', async () => {
    const client = await addClient(bank, { name: 'Flagged Fran' });
    const watch = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Watch the client"
description: waits for a flag on its applicant
correlation:
  client: "= case.applicant.id"
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [wait] }] }
  - { id: wait, name: Flagged?, type: event.wait, config: { event: client.flagged, match: { client: "= data.clientId" }, timeout: PT90S }, events: [{ name: received, outputs: [], next: [save] }, { name: timeout, outputs: [], next: [calm] }] }
  - { id: save, name: Save, type: case.update, config: { data: { category: "= steps.wait.category" } }, events: [{ name: done, outputs: [], next: [flagged] }] }
${decision('flagged')}
${decision('calm', 'expired')}
`);
    const started = await bank.adminApi.post(`/workflows/${watch}/executions`, { inputs: { email: client.email, fullName: 'Flagged Fran' } });
    expectStatus(started, 202);
    await waiting(started.body.caseId);
    expectStatus(await bank.adminApi.post(`/clients/${client.user.userId}/flags`, { reason: 'Many cash deposits', category: 'structuring' }), 201);
    expect((await waitForCase(bank.adminApi, started.body.caseId, (c) => c.status === 'completed')).data.category).toBe('structuring');
  });

  test('events need events:publish; a workflow cannot wait on a key it does not declare', async () => {
    const starter = await bank.adminApi.post('/api-clients', { name: 'Starter', permissions: ['cases:create'] });
    const token = await Api.anonymous().post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: starter.body.clientId, client_secret: starter.body.clientSecret }));
    expectStatus(await Api.withToken(token.body.access_token, bank.key).post('/events', { id: 'x', type: 'loan.payment', data: {} }), 403);
    const draft = await bank.adminApi.post('/workflows', { yaml: servicingYaml('Broken').replace('correlation:\n  loan: "= input.loanId"\n', '') });
    expectStatus(draft, 201);
    const published = await bank.adminApi.post(`/workflows/${draft.body.id}/publish`);
    expect(published.status).toBe(422);
    expect(published.body.errors.join(' ')).toContain('matches on the key "loan"');
  });
});

test.describe('AUT-09 One case per loan receives every payment (start or deliver)', { tag: ['@integrations', '@AUT-09'] }, () => {
  test('the first payment opens the case; the next go to it, even while it is busy; another loan opens its own', async () => {
    await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Payments of a loan"
description: one case per loan
startOn:
  - { event: "api:loan.repayment", correlate: { loan: "= data.loanId" } }
correlation:
  loan: "= input.loanId"
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [first] }] }
  - { id: first, name: First payment, type: case.update, config: { data: { first: "= input.amount" } }, events: [{ name: done, outputs: [], next: [next] }] }
  - { id: next, name: Next payment, type: event.wait, config: { event: "api:loan.repayment", match: { loan: "= data.loanId" }, timeout: PT90S }, events: [{ name: received, outputs: [], next: [slow] }, { name: timeout, outputs: [], next: [closed] }] }
  - { id: slow, name: Book it, type: wait, config: { duration: PT1S }, events: [{ name: done, outputs: [], next: [book] }] }
  - { id: book, name: Booked, type: case.update, config: { data: { last: "= steps.next.amount" } }, events: [{ name: done, outputs: [], next: [next] }] }
${decision('closed')}
`);
    const opened = await publish('r1', 'loan.repayment', { loanId: `R1-${stamp}`, amount: 100 });
    expect(opened.body.started).toHaveLength(1);
    const caseId = opened.body.started[0].id;
    await expect.poll(async () => (await waits(caseId)).find((w) => w.kind === 'event')?.status, { timeout: 20_000 }).toBe('waiting');

    // Two more, back to back: the second arrives while the case books the first; it is kept for the case.
    const second = await publish('r2', 'loan.repayment', { loanId: `R1-${stamp}`, amount: 200 });
    const third = await publish('r3', 'loan.repayment', { loanId: `R1-${stamp}`, amount: 300 });
    expect(second.body).toMatchObject({ started: [], delivered: [{ id: caseId }] });
    expect(third.body).toMatchObject({ started: [], delivered: [{ id: caseId }] });
    await expect.poll(async () => (await bank.adminApi.get(`/cases/${caseId}`)).body.data.last, { timeout: 20_000 }).toBe(300);
    const received = (await waits(caseId)).filter((w) => w.kind === 'event' && w.status === 'delivered');
    expect(received).toHaveLength(2);

    const other = await publish('r4', 'loan.repayment', { loanId: `R2-${stamp}`, amount: 50 });
    expect(other.body.started).toHaveLength(1);
    expect(other.body.started[0].id).not.toBe(caseId);
  });
});

test.describe('AUT-10 A workflow polls until a condition holds', { tag: ['@integrations', '@AUT-10'] }, () => {
  const pollYaml = (name: string, timeout: string) => `schemaVersion: "1"
name: "${name}"
description: waits for the client's report to be ready
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [poll] }] }
  - id: poll
    name: Report ready?
    type: poll
    config: { call: { type: client.data, config: { collection: reports } }, until: "$count(records[status = 'ready']) > 0", every: PT1S, timeout: ${timeout} }
    events: [{ name: done, outputs: [], next: [save] }, { name: timeout, outputs: [], next: [gave_up] }, { name: failed, outputs: [], next: [gave_up] }]
  - { id: save, name: Save, type: case.update, config: { data: { attempts: "= steps.poll.attempts", report: "= steps.poll.first.key" } }, events: [{ name: done, outputs: [], next: [ready] }] }
${decision('ready')}
${decision('gave_up', 'expired')}
`;

  test('asked every second: done once the report is ready; given up after the time limit', async () => {
    const client = await addClient(bank, { name: 'Report Rory' });
    const workflowId = await publishWorkflow(bank.adminApi, pollYaml('Report ready', 'PT60S'));
    expectStatus(await bank.adminApi.put(`/clients/${client.user.userId}/records/reports`, { records: [{ key: 'rep-1', data: { status: 'preparing' } }] }), 200);
    const started = await bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: client.email, fullName: 'Report Rory' } });
    expectStatus(started, 202);
    await new Promise((r) => setTimeout(r, 3500));
    expect((await bank.adminApi.get(`/cases/${started.body.caseId}`)).body.status).toBe('in_progress');
    expectStatus(await bank.adminApi.put(`/clients/${client.user.userId}/records/reports`, { records: [{ key: 'rep-1', data: { status: 'ready' } }] }), 200);
    const done = await waitForCase(bank.adminApi, started.body.caseId, (c) => c.status === 'completed', 20_000);
    expect(done.data.report).toBe('rep-1');
    expect(done.data.attempts).toBeGreaterThan(2);

    const quick = await publishWorkflow(bank.adminApi, pollYaml('Report ready (3 s)', 'PT3S'));
    const never = await bank.adminApi.post(`/workflows/${quick}/executions`, { inputs: { email: uniqueFor(client.email), fullName: 'Nobody' } });
    expectStatus(never, 202);
    await waitForCase(bank.adminApi, never.body.caseId, (c) => c.status === 'expired', 20_000);
  });
});

const uniqueFor = (email: string) => email.replace('@', `+never-${Date.now()}@`);
