import { test, expect } from '@playwright/test';
import { expectStatus } from '../../support/api';
import { addClient, addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { env } from '../../support/env';
import { minimalWorkflowYaml } from '../../support/workflows';

/**
 * X-06: the Restate ingress must not be a second, unguarded API. Found while writing this suite: any signed-in client
 * could call administrative handlers (e.g. roles/createRole) through the ingress, and workflow.start authorised
 * against a caller-supplied definition. Nothing of the legacy node engine is ingress-public any more (its trigger/resume
 * handlers carried user tokens into the Restate journal); the case engine only accepts the API's signed calls.
 */
let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

const ingress = (token: string, path: string, body: unknown) =>
  fetch(new URL(path, env.restateIngressUrl), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant': bank.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test.describe('X-06 The Restate ingress is not a way around authorization', { tag: ['@cross-cutting', '@X-06'] }, () => {
  test('administrative handlers and workflow nodes are not reachable through the ingress', async () => {
    const client = await addClient(bank);
    for (const path of ['/roles/x/createRole', '/users/x/getUsers', '/tenant/x/createTenant', '/email/x/executeNode', '/database/x/executeNode']) {
      const res = await ingress(client.token, path, { name: 'via-ingress', description: '', permissions: ['admin'] });
      // The legacy API objects and workflow nodes are gone from the Restate endpoint (404); before, they were private (400).
      expect([400, 404], `${path} should not be reachable`).toContain(res.status);
    }
    // The case engine only accepts calls signed by the API (x-fintivio-signature). (No token is sent here: anything
    // sent to the ingress lands in the journal, see X-05.)
    for (const path of [`/caseRun/${crypto.randomUUID()}/run`, `/caseRun/${crypto.randomUUID()}/signal`]) {
      const res = await fetch(new URL(path, env.restateIngressUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: bank.tenant.id, caseId: 'x', taskId: 'x', signal: { outcome: 'approve' } }),
      });
      expect(res.status, `${path} should refuse unsigned calls`).toBe(403);
    }
    const roles = (await bank.adminApi.get('/roles')).body as any[];
    expect(roles.map((r) => r.id)).not.toContain('via_ingress');
  });

  test('clients cannot start workflows directly', async () => {
    const client = await addClient(bank);
    const created = await bank.adminApi.post('/workflows', { yaml: minimalWorkflowYaml(`Ingress ${Date.now()}`) });
    // Executions start through the API (POST /workflows/:id/executions); workflow.start is not public at all.
    const res = await ingress(client.token, `/workflow/x-${Date.now()}/start`, { workflowId: created.body.id, variables: {} });
    expect([400, 403, 404]).toContain(res.status);
  });

  test("a caller cannot bypass a workflow's allowedRoles by sending their own definition", async () => {
    const restricted = minimalWorkflowYaml(`Admins only ${Date.now()}`).replace('triggers: []', 'allowedRoles: [admin]\ntriggers: []');
    const created = await bank.adminApi.post('/workflows', { yaml: restricted });
    expectStatus(created, 201);
    const member = await addMember(bank, { roles: ['reviewer'] });
    const res = await ingress(member.token, `/workflow/x-${Date.now()}/start`, {
      workflowId: created.body.id,
      yaml: minimalWorkflowYaml('forged without allowedRoles'),
      variables: {},
      token: member.token,
      domain: bank.key,
    });
    expect(res.status).not.toBe(200);
    expect(await res.text()).toMatch(/does not have access|Forbidden|not public|not found/i);
  });

  test('the legacy engine cannot be triggered or resumed through the ingress', async () => {
    const member = await addMember(bank, { roles: ['admin'] });
    for (const handler of ['trigger', 'resume']) {
      const res = await ingress(member.token, `/workflow/x-${Date.now()}/${handler}`, { workflowId: 'x', variables: {}, token: member.token, domain: bank.key });
      expect(res.status, handler).not.toBe(200);
    }
    // Nor the case engine without the API's signature (sent without a token: whatever reaches an ingress is journaled,
    // which is why the ingress must not be publicly reachable in deployed environments).
    const caseId = crypto.randomUUID();
    const res = await fetch(new URL(`/caseRun/${caseId}/run`, env.restateIngressUrl), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: bank.tenant.id, caseId }) });
    expect(res.status).not.toBe(200);
  });
});
