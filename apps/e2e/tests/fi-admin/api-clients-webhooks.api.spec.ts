import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { Api, decodeJwt, expectAllowed, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { fakeRecords, requireFake } from '../../support/fakes';
import { minimalWorkflowYaml, publishWorkflow } from '../../support/workflows';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

async function tokenFor(clientId: string, clientSecret: string) {
  return Api.anonymous(bank.key).post('/oauth/token', new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }));
}

test.describe('FIA-10 API credentials (OAuth 2.0 client credentials)', { tag: ['@fi-admin', '@FIA-10'] }, () => {
  test('an API client gets short-lived tokens limited to its permissions; the secret is shown once', async () => {
    const created = await bank.adminApi.post('/api-clients', { name: 'Core banking sync', permissions: ['cases:read', 'cases:create'] });
    expectStatus(created, 201);
    expect(created.body.clientSecret).toBeTruthy();
    const listed = await bank.adminApi.get('/api-clients');
    expect(JSON.stringify(listed.body)).not.toContain(created.body.clientSecret);

    const token = await tokenFor(created.body.clientId, created.body.clientSecret);
    expectStatus(token, 200);
    expect(token.body.token_type).toBe('Bearer');
    const claims = decodeJwt(token.body.access_token);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(900);

    const machine = Api.withToken(token.body.access_token, bank.key);
    expectAllowed(await machine.get('/cases'));
    expectForbidden(await machine.post('/roles', { name: 'machine role', description: '', permissions: [] }));
    expectForbidden(await machine.get('/users'));
  });

  test('the API can start a workflow (API trigger)', async () => {
    const workflowId = await publishWorkflow(bank.adminApi, minimalWorkflowYaml(`API triggered ${Date.now()}`));
    const created = await bank.adminApi.post('/api-clients', { name: 'Starter', permissions: ['cases:create'] });
    const token = await tokenFor(created.body.clientId, created.body.clientSecret);
    const started = await Api.withToken(token.body.access_token, bank.key).post(`/workflows/${workflowId}/executions`, { inputs: {} });
    expectStatus(started, 202);
    expect(started.body.executionId).toBeTruthy();
  });

  test('POST requests with an Idempotency-Key are processed once and replayed for retries', async () => {
    const workflowId = await publishWorkflow(bank.adminApi, minimalWorkflowYaml(`Idempotent ${Date.now()}`));
    const created = await bank.adminApi.post('/api-clients', { name: 'Retrier', permissions: ['cases:create'] });
    const token = await tokenFor(created.body.clientId, created.body.clientSecret);
    const machine = Api.withToken(token.body.access_token, bank.key).withHeaders({ 'Idempotency-Key': `start-${Date.now()}` });
    const first = await machine.post(`/workflows/${workflowId}/executions`, { inputs: {} });
    expectStatus(first, 202);
    const retry = await machine.post(`/workflows/${workflowId}/executions`, { inputs: {} });
    expectStatus(retry, 202);
    expect(retry.body.caseId).toBe(first.body.caseId);
    expect(retry.headers.get('idempotent-replayed')).toBe('true');
    expectStatus(await machine.post(`/workflows/${workflowId}/executions`, { inputs: { other: true } }), 422);
  });

  test('wrong secrets and revoked clients get no token', async () => {
    const created = await bank.adminApi.post('/api-clients', { name: 'Revoked', permissions: ['cases:read'] });
    expectStatus(await tokenFor(created.body.clientId, 'wrong-secret'), 401);
    expectStatus(await bank.adminApi.delete(`/api-clients/${created.body.clientId}`), 204);
    expectStatus(await tokenFor(created.body.clientId, created.body.clientSecret), 401);
  });

  test('an API client cannot receive permissions its creator does not hold', async () => {
    const integrator = await addMember(bank, { roles: ['integration_manager'] });
    expectForbidden(await Api.as(integrator).post('/api-clients', { name: 'Too powerful', permissions: ['roles:manage'] }));
  });
});

/** Standard Webhooks signature: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)), secret `whsec_<base64>`. */
const standardWebhookSignature = (secret: string, id: string, timestamp: string, body: string) =>
  createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64');

test.describe('X-07 Signed outbound webhooks', { tag: ['@fi-admin', '@FIA-10', '@X-07'] }, () => {
  test('subscribed events are delivered with a verifiable Standard Webhooks signature', async () => {
    const receiver = await requireFake('webhookReceiver');
    const endpoint = `${receiver}/hooks/${bank.key}`;
    const subscription = await bank.adminApi.post('/webhooks', { url: endpoint, events: ['case.created'] });
    expectStatus(subscription, 201);
    expect(subscription.body.secret).toMatch(/^whsec_/);

    const workflowId = await publishWorkflow(bank.adminApi, minimalWorkflowYaml(`Webhook ${Date.now()}`));
    expectStatus(await bank.adminApi.post(`/workflows/${workflowId}/executions`, { inputs: {} }), 202);

    await expect.poll(async () => (await fakeRecords<any[]>('webhookReceiver', `/deliveries?path=/hooks/${bank.key}`)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const [delivery] = await fakeRecords<any[]>('webhookReceiver', `/deliveries?path=/hooks/${bank.key}`);
    const { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': signature } = delivery.headers;
    expect(signature).toBe(`v1,${standardWebhookSignature(subscription.body.secret, id, timestamp, delivery.body)}`);
    expect(JSON.parse(delivery.body).type).toBe('case.created');
  });
});
