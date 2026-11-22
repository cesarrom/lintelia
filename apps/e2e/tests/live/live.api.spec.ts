import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { addClient, addMember, createTenant, deleteTenant, signIn, type TenantHandle } from '../../support/factories';
import { controlFake, fakeRecords, requireFake } from '../../support/fakes';
import { changeOf, messageOn, openLive, openLiveUrl } from '../../support/live';
import { waitForCase, waitForTask } from '../../support/scenario';
import { publishWorkflow } from '../../support/workflows';
import { env } from '../../support/env';

/**
 * Screens that update by themselves (docs/plans/17 §4), through the API: Server-Sent Events on `GET /live`. Changes are
 * thin (the screen fetches again through the authorised endpoints): a client's records and notifications (LIVE-01),
 * the team's queues and tasks (LIVE-02); what a workflow publishes is kept and replayed to screens that listen late,
 * and its capability address serves screens we do not (LIVE-03); who may listen (LIVE-04); a workflow's message to a
 * webhook subscription, the applicant or a member (LIVE-05).
 */
test.describe.configure({ mode: 'serial', timeout: 90_000 });

let bank: TenantHandle;
let client: Awaited<ReturnType<typeof addClient>>;
let other: Awaited<ReturnType<typeof addClient>>;
let reviewer: Awaited<ReturnType<typeof addMember>>;
let rm: Awaited<ReturnType<typeof addMember>>;

test.beforeAll(async () => {
  bank = await createTenant();
  client = await addClient(bank, { name: 'Lively Lou' });
  other = await addClient(bank, { name: 'Other Olly' });
  reviewer = await addMember(bank, { roles: ['reviewer'], label: 'reviewer' });
  rm = await addMember(bank, { roles: ['relationship_manager'], label: 'rm' });
});
test.afterAll(async () => { await deleteTenant(bank); });

const decision = (id: string, status = 'completed') => `  - { id: ${id}, name: ${id}, type: case.decision, config: { status: ${status}, notifyApplicant: false }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }`;

test.describe('LIVE-01 A client\'s data changes on their screen as it happens', { tag: ['@client', '@LIVE-01'] }, () => {
  test('records written by the core banking system and notifications of a workflow reach the client\'s stream', async () => {
    const me = client.user.userId;
    const stream = await openLive(client, bank.key, [`client/${me}/records/*`, `client/${me}/notifications`]);
    expect(stream.status).toBe(200);
    await stream.waitFor((e) => e.event === 'ready');
    expectStatus(await bank.adminApi.put(`/clients/${me}/records/accounts`, { records: [{ key: 'cur-1', data: { name: 'Everyday', balance: 10, currency: 'GBP' } }] }), 200);
    await stream.waitFor(changeOf(`client/${me}/records/accounts`), 5_000);

    const notify = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Say hello"
description: a notification
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [hello] }] }
  - { id: hello, name: Hello, type: client.notify, config: { title: Hello, body: Your card is on its way, tone: info }, events: [{ name: done, outputs: [], next: [done] }] }
${decision('done')}
`);
    expectStatus(await bank.adminApi.post(`/workflows/${notify}/executions`, { inputs: { email: client.email, fullName: 'Lively Lou' } }), 202);
    await stream.waitFor(changeOf(`client/${me}/notifications`), 15_000);
    // The change says what changed, never the data itself.
    expect(stream.raw()).not.toContain('Your card is on its way');
    // Members who may read clients follow them too.
    const member = await openLive(reviewer, bank.key, [`client/${me}/records/accounts`]);
    expect(member.status).toBe(200);
    member.close();
    stream.close();
  });
});

test.describe('LIVE-02 The team\'s queues and tasks update as cases move', { tag: ['@reviewer', '@LIVE-02'] }, () => {
  test('a review lands in the reviewers\' queue; taking it reaches the member\'s own topic; the case changes', async () => {
    const workflowId = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Review it"
description: one review
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [review] }] }
  - { id: review, name: Review, type: review, config: { title: "Review {{case.reference}}", assignTo: { role: reviewer } }, events: [{ name: review_approved, outputs: [], next: [done] }, { name: review_rejected, outputs: [], next: [done] }] }
${decision('done')}
`);
    const me = reviewer.user.userId;
    const stream = await openLive(reviewer, bank.key, ['queue/reviewer', `member/${me}`, 'cases']);
    expect(stream.status).toBe(200);
    await stream.waitFor((e) => e.event === 'ready');
    const started = await bank.adminApi.post('/cases', { workflowId, inputs: {} });
    await stream.waitFor(changeOf('queue/reviewer'), 15_000);
    await stream.waitFor(changeOf('cases'), 5_000);
    const task = await waitForTask(Api.as(reviewer), started.body.id, { view: 'queue' });
    const caseStream = await openLive(reviewer, bank.key, [`case/${started.body.id}`]);
    expectStatus(await Api.as(reviewer).post(`/tasks/${task.id}/claim`), 200);
    await stream.waitFor(changeOf(`member/${me}`), 5_000);
    await caseStream.waitFor(changeOf(`case/${started.body.id}`), 5_000);
    stream.close();
    caseStream.close();
  });
});

test.describe('LIVE-03 What a workflow publishes reaches the screen that started it, from the start', { tag: ['@flow-designer', '@LIVE-03'] }, () => {
  test('the start answer says where to listen; a late listener gets what it missed, in order; the capability address serves one channel', async () => {
    const workflowId = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Checks with progress"
description: publishes its progress
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [address] }] }
  - { id: address, name: Address, type: case.update, config: { data: { follow: "= case.live.progress" } }, events: [{ name: done, outputs: [], next: [first] }] }
  - { id: first, name: Checking, type: live.publish, config: { to: case, channel: progress, payload: { text: "Checking your ID…", step: "1" } }, events: [{ name: done, outputs: [], next: [hold] }] }
  - { id: hold, name: Hold, type: webhook.wait, config: { name: go, timeout: PT60S }, events: [{ name: received, outputs: [], next: [second] }, { name: timeout, outputs: [], next: [second] }] }
  - { id: second, name: Done checking, type: live.publish, config: { to: case, channel: progress, payload: { text: "= 'All good, ' & input.name", step: "2" } }, events: [{ name: done, outputs: [], next: [done] }] }
${decision('done')}
`);
    const started = await bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { name: 'Lou' } });
    expectStatus(started, 202);
    const caseId = started.body.caseId as string;
    expect(started.body.live.topics).toEqual([`case/${caseId}`, `case/${caseId}/channel/*`]);
    const topic = `case/${caseId}/channel/progress`;
    await expect.poll(async () => (await bank.adminApi.get(`/cases/${caseId}`)).body.data.follow, { timeout: 15_000 }).toContain('/live/cases/');

    // Listening after the first message: it is replayed (since=0), the next one arrives live, in order.
    await new Promise((r) => setTimeout(r, 500));
    const stream = await openLive(bank.admin, bank.key, started.body.live.topics, { since: 0 });
    expect(stream.status).toBe(200);
    const first = await stream.waitFor(messageOn(topic, (p) => p.step === '1'), 10_000);
    expect(first.data.payload).toMatchObject({ text: 'Checking your ID…', case: { id: caseId } });
    expectStatus(await bank.adminApi.post(`/cases/${caseId}/signals/go`, {}), 202);
    const second = await stream.waitFor(messageOn(topic, (p) => p.step === '2'), 15_000);
    expect(second.data.payload.text).toBe('All good, Lou');
    expect(Number(second.id)).toBeGreaterThan(Number(first.id));
    stream.close();

    // The capability address (for a kiosk, a partner's page): no account, this channel only, everything kept.
    const follow = (await bank.adminApi.get(`/cases/${caseId}`)).body.data.follow as string;
    const open = await openLiveUrl(follow.replace(/^https?:\/\/[^/]+/, env.apiUrl));
    expect(open.status).toBe(200);
    await open.waitFor(messageOn(topic, (p) => p.step === '2'), 10_000);
    expect(open.events.filter((e) => e.event === 'message').map((e) => e.data.payload.step)).toEqual(['1', '2']);
    open.close();
    const forged = await openLiveUrl(follow.replace(/^https?:\/\/[^/]+/, env.apiUrl).replace('/channels/progress', '/channels/secrets'));
    expect(forged.status).toBe(403);
    const tampered = await openLiveUrl(follow.replace(/^https?:\/\/[^/]+/, env.apiUrl).replace(/token=[^&]+/, 'token=x'));
    expect(tampered.status).toBe(403);
    await waitForCase(bank.adminApi, caseId, (c) => c.status === 'completed');
  });
});

test.describe('LIVE-04 Who may listen to what', { tag: ['@cross-cutting', '@LIVE-04'] }, () => {
  test('only one\'s own topics, cases in scope, the queues of one\'s roles; no account, no stream', async () => {
    const denied = await openLive(other, bank.key, [`client/${client.user.userId}/records/*`]);
    expect(denied.status).toBe(403);
    expect(denied.error.denied).toEqual([`client/${client.user.userId}/records/*`]);
    // A client cannot read another client's notifications, even as a member could read their records.
    expect((await openLive(reviewer, bank.key, [`client/${client.user.userId}/notifications`])).status).toBe(403);
    expect((await openLive(reviewer, bank.key, ['queue/compliance_officer'])).status).toBe(403);
    expect((await openLive(reviewer, bank.key, [`member/${rm.user.userId}`])).status).toBe(403);
    expect((await openLive(reviewer, bank.key, ['anything/else'])).status).toBe(403);

    // A case outside the member's scope: relationship managers see the cases they started.
    const workflowId = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Quiet"
description: waits
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [hold] }] }
  - { id: hold, name: Hold, type: webhook.wait, config: { name: go, timeout: PT30S }, events: [{ name: received, outputs: [], next: [done] }, { name: timeout, outputs: [], next: [done] }] }
${decision('done')}
`);
    const kase = (await bank.adminApi.post('/cases', { workflowId, inputs: {} })).body;
    expect((await openLive(rm, bank.key, [`case/${kase.id}`])).status).toBe(403);
    expect((await openLive(client, bank.key, [`case/${kase.id}`])).status).toBe(403);
    const anonymous = await fetch(`${env.apiUrl}/live?topics=cases`, { headers: { 'X-Tenant': bank.key } });
    expect(anonymous.status).toBe(401);
  });

  test('EventSource: a ticket opens one stream, once; signing out ends the stream', async () => {
    const issued = await Api.as(client).post('/live/tickets');
    expectStatus(issued, 201);
    const url = `${env.apiUrl}/live?ticket=${issued.body.ticket}&topics=${encodeURIComponent(`client/${client.user.userId}/profile`)}`;
    const stream = await openLiveUrl(url);
    expect(stream.status).toBe(200);
    await stream.waitFor((e) => e.event === 'ready');
    expect((await openLiveUrl(url)).status).toBe(401);
    stream.close();

    // Keep-alive comments, then the session ends: the stream says so and closes.
    const who = await signIn(bank.key, client.email);
    const held = await openLive(who, bank.key, [`client/${client.user.userId}/profile`]);
    expect(held.status).toBe(200);
    await expect.poll(() => held.raw().includes(': ping'), { timeout: 15_000 }).toBe(true);
    expectStatus(await Api.as(who).post('/auth/logout'), [200, 204]);
    await held.waitFor((e) => e.event === 'revoked', 15_000);
    await expect.poll(() => held.closed(), { timeout: 5_000 }).toBe(true);
  });
});

test.describe('LIVE-05 A workflow tells a system, the applicant or a member', { tag: ['@integrations', '@LIVE-05'] }, () => {
  test('to a webhook subscription (signed, in its log), to the applicant\'s and to the starting member\'s messages', async () => {
    const receiver = await requireFake('webhookReceiver');
    const path = `/hooks/${bank.key}-live-${Date.now().toString(36)}`;
    const subscription = await bank.adminApi.post('/webhooks', { url: `${receiver}${path}`, eventTypes: ['case.decided'], description: 'core banking' });
    expectStatus(subscription, 201);
    await controlFake('webhookReceiver', '/secrets', { path, secret: subscription.body.secret });
    const workflowId = await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: "Funded"
description: tells everyone
inputs: []
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [core] }] }
  - { id: core, name: Tell core banking, type: live.publish, config: { to: webhook, subscription: "${subscription.body.id}", payload: { status: funded, amount: "= input.amount" } }, events: [{ name: done, outputs: [], next: [client] }, { name: failed, outputs: [], next: [client] }] }
  - { id: client, name: Tell the client, type: live.publish, config: { to: applicant, payload: { text: Your loan is funded } }, events: [{ name: done, outputs: [], next: [member] }, { name: failed, outputs: [], next: [member] }] }
  - { id: member, name: Tell the adviser, type: live.publish, config: { to: member, payload: { text: "= 'Funded: ' & case.reference" } }, events: [{ name: done, outputs: [], next: [done] }, { name: failed, outputs: [], next: [done] }] }
${decision('done')}
`);
    const me = bank.admin.user.userId;
    const clientStream = await openLive(client, bank.key, [`client/${client.user.userId}/messages`], { since: 0 });
    const memberStream = await openLive(bank.admin, bank.key, [`member/${me}/messages`], { since: 0 });
    const started = await bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: { email: client.email, fullName: 'Lively Lou', amount: 15000 } });
    expectStatus(started, 202);
    await clientStream.waitFor(messageOn(`client/${client.user.userId}/messages`, (p) => p.text === 'Your loan is funded'), 15_000);
    const told = await memberStream.waitFor(messageOn(`member/${me}/messages`), 15_000);
    expect(told.data.payload.text).toBe(`Funded: ${started.body.reference}`);

    await expect.poll(async () => (await fakeRecords<any[]>('webhookReceiver', `/deliveries?path=${path}`)).length, { timeout: 20_000 }).toBe(1);
    const [delivery] = await fakeRecords<any[]>('webhookReceiver', `/deliveries?path=${path}`);
    expect(delivery.verified).toBe(true);
    expect(JSON.parse(delivery.body)).toMatchObject({ type: 'case.message', data: { caseId: started.body.caseId, reference: started.body.reference, step: 'core', message: { status: 'funded', amount: 15000 } } });
    const log = (await bank.adminApi.get(`/webhooks/${subscription.body.id}/deliveries`)).body as Array<{ eventType: string }>;
    expect(log[0].eventType).toBe('case.message');
    clientStream.close();
    memberStream.close();
  });
});
