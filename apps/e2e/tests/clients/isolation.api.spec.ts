import { test, expect } from '../../support/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addClient, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { minimalWorkflowYaml, publishWorkflow, simpleFormConfig } from '../../support/workflows';

let bank: TenantHandle;
test.beforeAll(async () => { bank = await createTenant(); });
test.afterAll(async () => { await deleteTenant(bank); });

test.describe('CLI-11 Clients see only their own data', { tag: ['@client', '@CLI-11'] }, () => {
  for (const path of ['/users', '/roles', '/workflows', '/logs', '/reviews', '/tenants/all']) {
    test(`clients cannot use back-office endpoint ${path}`, async () => {
      const client = await addClient(bank);
      expectForbidden(await Api.as(client).get(path));
    });
  }

  test('a client cannot open a form instance issued to someone else', async () => {
    const form = await bank.adminApi.post('/forms', { name: 'Internal', config: simpleFormConfig('internal') });
    const instance = await bank.adminApi.post(`/forms/${form.body.id}/instances`, { variables: {} });
    expectStatus(instance, 201);
    const client = await addClient(bank);
    expectStatus(await Api.as(client).get(`/forms/instances/${instance.body.id}`), 404);
    expectStatus(await Api.as(client).post(`/forms/instances/${instance.body.id}/answers`, { answers: { x: 1 } }), 404);
  });

  test("a client cannot open another client's case", async () => {
    const alice = await addClient(bank, { label: 'alice' });
    const bob = await addClient(bank, { label: 'bob' });
    const workflowId = await publishWorkflow(bank.adminApi, minimalWorkflowYaml(`Isolation ${Date.now()}`));
    const created = await bank.adminApi.post('/cases', { workflowId, client: { email: alice.email, name: 'Alice' }, inputs: {} });
    expectStatus(created, 201);
    expectStatus(await Api.as(alice).get(`/me/cases/${created.body.id}`), 200);
    expectStatus(await Api.as(bob).get(`/me/cases/${created.body.id}`), 404);
    const bobs = await Api.as(bob).get('/me/cases');
    expectStatus(bobs, 200);
    expect((bobs.body as any[]).map((c) => c.id)).not.toContain(created.body.id);
  });
});
