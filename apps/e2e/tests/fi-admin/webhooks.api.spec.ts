import { test, expect } from '../../support/test';
import { Api, expectStatus } from '../../support/api';
import { createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { controlFake, fakeRecords, requireFake } from '../../support/fakes';
import { minimalWorkflowYaml, publishWorkflow } from '../../support/workflows';

/**
 * WH-*: outbound webhooks are durable (Restate) with retries, a delivery log, resend, secret rotation and disabling;
 * the institution's systems start workflows with events and hear back through webhooks (docs/plans/04).
 * The local retry schedule is short (WEBHOOK_RETRY_SCHEDULE=2,4,8,…).
 */
let bank: TenantHandle;
let receiver: string;
test.beforeAll(async () => {
  receiver = await requireFake('webhookReceiver');
  bank = await createTenant();
});
test.afterAll(async () => { await deleteTenant(bank); });

const hookPath = (name: string) => `/hooks/${bank.key}-${name}-${Date.now().toString(36)}`;
const received = (path: string) => fakeRecords<any[]>('webhookReceiver', `/deliveries?path=${path}`);

async function subscribe(path: string, eventTypes: string[]) {
  const created = await bank.adminApi.post('/webhooks', { url: `${receiver}${path}`, eventTypes, description: 'e2e' });
  expectStatus(created, 201);
  await controlFake('webhookReceiver', '/secrets', { path, secret: created.body.secret });
  return created.body as { id: string; secret: string };
}

const startCase = async () => {
  const workflowId = await publishWorkflow(bank.adminApi, minimalWorkflowYaml(`Webhook source ${Date.now()}`));
  expectStatus(await bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: {} }), 202);
};

test.describe('WH-01 Webhook retries, delivery log and resend', { tag: ['@fi-admin', '@WH-01', '@X-07'] }, () => {
  test('a failing endpoint is retried until it answers; the delivery log shows every attempt', async () => {
    const path = hookPath('retry');
    const subscription = await subscribe(path, ['case.created']);
    await controlFake('webhookReceiver', '/fail-next', { path, count: 3, status: 503 });
    await startCase();

    await expect.poll(async () => (await received(path)).map((d) => d.answeredWith), { timeout: 45_000, intervals: [1000] }).toEqual([503, 503, 503, 200]);
    const deliveries = (await received(path));
    // Same message id on every attempt (receivers deduplicate on it), each attempt signed with a valid signature.
    expect(new Set(deliveries.map((d) => d.headers['webhook-id'])).size).toBe(1);
    expect(deliveries.every((d) => d.verified)).toBe(true);

    await expect.poll(async () => ((await bank.adminApi.get(`/webhooks/${subscription.id}/deliveries`)).body as any[])[0]?.status, { timeout: 10_000 }).toBe('delivered');
    const [log] = (await bank.adminApi.get(`/webhooks/${subscription.id}/deliveries`)).body as any[];
    expect(log).toMatchObject({ eventType: 'case.created', attemptCount: 4, lastStatusCode: 200 });
    expect(log.attempts.map((a: any) => a.statusCode)).toEqual([503, 503, 503, 200]);

    // Resend delivers the same event again.
    expectStatus(await bank.adminApi.post(`/webhooks/deliveries/${log.id}/resend`), 202);
    await expect.poll(async () => (await received(path)).length, { timeout: 15_000 }).toBe(5);
    expect((await received(path))[4].headers['webhook-id']).toBe(deliveries[0].headers['webhook-id']);
  });

  test('a test event can be sent to one endpoint', async () => {
    const path = hookPath('test');
    const subscription = await subscribe(path, ['case.decided']);
    expectStatus(await bank.adminApi.post(`/webhooks/${subscription.id}/test`), 202);
    await expect.poll(async () => (await received(path)).length, { timeout: 15_000 }).toBe(1);
    const [delivery] = await received(path);
    expect(JSON.parse(delivery.body)).toMatchObject({ type: 'webhook.test', tenant: bank.key });
    expect(delivery.verified).toBe(true);
  });

  test('after a secret rotation both secrets verify for a while; the new secret is shown once', async () => {
    const path = hookPath('rotate');
    const subscription = await subscribe(path, ['case.created']);
    const rotated = await bank.adminApi.post(`/webhooks/${subscription.id}/rotate-secret`);
    expectStatus(rotated, 200);
    expect(rotated.body.secret).toMatch(/^whsec_/);
    expect(rotated.body.secret).not.toBe(subscription.secret);
    expect(JSON.stringify((await bank.adminApi.get('/webhooks')).body)).not.toContain(rotated.body.secret);
    expectStatus(await bank.adminApi.post(`/webhooks/${subscription.id}/test`), 202);
    await expect.poll(async () => (await received(path)).length, { timeout: 15_000 }).toBe(1);
    const [delivery] = await received(path);
    // Two signatures during the overlap: receivers still on the old secret keep verifying.
    expect(delivery.headers['webhook-signature'].split(' ')).toHaveLength(2);
    expect(delivery.verified).toBe(true);
    await controlFake('webhookReceiver', '/secrets', { path, secret: rotated.body.secret });
    expectStatus(await bank.adminApi.post(`/webhooks/${subscription.id}/test`), 202);
    await expect.poll(async () => (await received(path)).length, { timeout: 15_000 }).toBe(2);
    expect((await received(path))[1].verified).toBe(true);
  });

  test('an endpoint answering 410 Gone is disabled', async () => {
    const path = hookPath('gone');
    const subscription = await subscribe(path, ['case.created']);
    await controlFake('webhookReceiver', '/respond', { path, status: 410 });
    expectStatus(await bank.adminApi.post(`/webhooks/${subscription.id}/test`), 202);
    await expect.poll(async () => (await bank.adminApi.get(`/webhooks/${subscription.id}`)).body.enabled, { timeout: 15_000 }).toBe(false);
    const webhook = (await bank.adminApi.get(`/webhooks/${subscription.id}`)).body;
    expect(webhook.disabledReason).toMatch(/410/);
    expect((await received(path))).toHaveLength(1);
  });

  test('webhook URLs and event types are validated', async () => {
    expectStatus(await bank.adminApi.post('/webhooks', { url: 'not a url', eventTypes: ['case.created'] }), 400);
    expectStatus(await bank.adminApi.post('/webhooks', { url: `${receiver}/hooks/x`, eventTypes: ['made.up'] }), 400);
    const catalogue = await bank.adminApi.get('/webhook-events');
    expectStatus(catalogue, 200);
    expect((catalogue.body as any[]).map((e) => e.type)).toEqual(expect.arrayContaining(['case.created', 'case.decided', 'task.created']));
  });
});

test.describe("WH-02 Start a workflow from the bank's system and hear back", { tag: ['@fi-admin', '@WH-02', '@FIA-10'] }, () => {
  test('an API client event starts a published workflow; the bank receives case.decided', async () => {
    const path = hookPath('roundtrip');
    await subscribe(path, ['case.decided']);
    const type = `loan.requested-${Date.now().toString(36)}`;
    await publishWorkflow(bank.adminApi, `schemaVersion: "1"
name: Auto decision ${Date.now()}
description: started by the bank's system
version: 1
startOn: ["api:${type}"]
triggers: []
inputs:
  - { id: amount, name: amount, type: number, required: true }
steps:
  - id: start
    name: Start
    type: start
    events:
      - { name: finished, outputs: [], next: [check] }
  - id: check
    name: Small amount?
    type: conditional
    config: { expression: "input.amount <= 1000" }
    events:
      - { name: "true", outputs: [], next: [approve] }
      - { name: "false", outputs: [], next: [reject] }
  - id: approve
    name: Approve
    type: case.decision
    config: { status: approved, outcome: auto_approved }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
  - id: reject
    name: Reject
    type: case.decision
    config: { status: rejected, outcome: too_large }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
`);
    // Publishing events is its own permission (docs/plans/17 §3.7): starting cases by hand (cases:create) is not enough.
    const starter = await bank.adminApi.post('/api-clients', { name: 'Case starter', permissions: ['cases:create'] });
    const starterToken = await Api.anonymous().post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: starter.body.clientId, client_secret: starter.body.clientSecret }));
    expectStatus(await Api.withToken(starterToken.body.access_token, bank.key).post('/events', { id: `evt-x-${Date.now()}`, type, data: {} }), 403);
    const client = await bank.adminApi.post('/api-clients', { name: 'Core banking', permissions: ['events:publish', 'cases:read'] });
    expectStatus(client, 201);
    const token = await Api.anonymous().post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: client.body.clientId, client_secret: client.body.clientSecret }));
    expectStatus(token, 200);
    const system = Api.withToken(token.body.access_token, bank.key);

    const eventId = `evt-${Date.now()}`;
    const published = await system.post('/events', { id: eventId, type, data: { amount: 500 } });
    expectStatus(published, 202);
    expect(published.body.started).toHaveLength(1);
    const reference = published.body.started[0].reference;
    // The same event id is not processed twice.
    expect((await system.post('/events', { id: eventId, type, data: { amount: 500 } })).body).toMatchObject({ duplicate: true });

    await expect.poll(async () => (await received(path)).length, { timeout: 20_000 }).toBe(1);
    const [delivery] = await received(path);
    expect(delivery.verified).toBe(true);
    expect(JSON.parse(delivery.body)).toMatchObject({ type: 'case.decided', data: { reference, status: 'approved', outcome: 'auto_approved' } });

    // The system fetches the details with its own credentials (thin events).
    const kase = await system.get(`/cases/${published.body.started[0].id}`);
    expectStatus(kase, 200);
    expect(kase.body.initiatedBy.type).toBe('api_client');
  });
});
