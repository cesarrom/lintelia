import { test, expect } from '@playwright/test';
import { Api, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { minimalWorkflowYaml } from '../../support/workflows';

let bankA: TenantHandle;
let bankB: TenantHandle;
test.beforeAll(async () => { [bankA, bankB] = await Promise.all([createTenant(), createTenant()]); });
test.afterAll(async () => { await Promise.all([deleteTenant(bankA), deleteTenant(bankB)]); });

test.describe('X-01 Tenant isolation through the API', { tag: ['@cross-cutting', '@X-01'] }, () => {
  test("a token is only valid for its own institution", async () => {
    expectStatus(await Api.as(bankA.admin, bankB.key).get('/users'), 401);
    expectStatus(await Api.as(bankA.admin, bankB.host).get('/auth/me'), 401);
  });

  test("guessing another institution's ids yields nothing", async () => {
    const workflow = await bankB.adminApi.post('/workflows', { yaml: minimalWorkflowYaml(`Secret flow ${Date.now()}`) });
    expectStatus(workflow, 201);
    const member = await addMember(bankB, { roles: ['reviewer'] });
    const users = (await bankB.adminApi.get('/users')).body as any[];
    const memberId = users.find((u) => u.email === member.email).id;

    expect([403, 404, 500]).toContain((await bankA.adminApi.get(`/workflows/${workflow.body.id}`)).status);
    expect((await bankA.adminApi.get(`/workflows/${workflow.body.id}`)).body?.yaml).toBeUndefined();
    expectStatus(await bankA.adminApi.get(`/users/${memberId}`), 404);
    const listA = (await bankA.adminApi.get('/workflows')).body as any[];
    expect(listA.map((w) => w.id)).not.toContain(workflow.body.id);
  });

  test("files of one institution cannot be read by another", async () => {
    const form = new FormData();
    form.append('file', new Blob(['confidential statement']), 'statement.txt');
    const uploaded = await bankB.adminApi.request('PUT', '/object', form);
    expectStatus(uploaded, 201);
    expectStatus(await bankA.adminApi.get(`/object/${uploaded.body.key}`), 404);
    expectStatus(await bankB.adminApi.get(`/object/${uploaded.body.key}`), 200);
  });
});
