import { test, expect } from '../../support/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, staffSession, type TenantHandle } from '../../support/factories';

/**
 * CON-04: platform staff maintain the connector registry (docs/plans/03). A throwaway connector (a manifest served by
 * this test) is registered, approved and revoked, so the shared local connectors are never touched.
 */
let server: Server;
let manifestUrl: string;
let bank: TenantHandle;
const id = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
let version = '1.0.0';

const manifest = () => ({
  id, version, name: `E2E connector ${id}`, description: 'registered by the e2e suite',
  publisher: { name: 'E2E' }, audiences: ['tenant'], baseUrl: manifestUrl.replace('/.well-known/fintivio-connector.json', ''),
  auth: { jwksUrl: '/.well-known/jwks.json' }, scopes: ['installation:write'],
  ui: { connect: { url: '/connect', mode: 'redirect' } },
  components: [{ key: 'ping', kind: 'action', title: 'Ping', events: ['done'], invoke: { url: '/actions/ping', mode: 'sync' } }],
});

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/.well-known/fintivio-connector.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest()));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  manifestUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/.well-known/fintivio-connector.json`;
  bank = await createTenant();
});
test.afterAll(async () => {
  await deleteTenant(bank);
  server?.close();
});

const catalogIds = async () => ((await bank.adminApi.get('/integrations/catalog')).body as any[]).map((c) => c.id);

test.describe('CON-04 Staff register, approve and revoke connector versions', { tag: ['@staff', '@CON-04'] }, () => {
  test('a registered version is a draft until approved; revoking removes it from every institution', async () => {
    const staff = Api.as(await staffSession());
    const registered = await staff.post('/platform/connectors', { manifestUrl });
    expectStatus(registered, 201);
    expect(registered.body).toMatchObject({ id, version: '1.0.0', status: 'draft' });
    expect(await catalogIds()).not.toContain(id);

    expectStatus(await staff.post(`/platform/connectors/${id}/versions/1.0.0/approve`), 200);
    await expect.poll(catalogIds, { timeout: 10_000 }).toContain(id);


    expectStatus(await staff.post(`/platform/connectors/${id}/revoke`), 200);
    await expect.poll(catalogIds, { timeout: 10_000 }).not.toContain(id);
    expectStatus(await bank.adminApi.post(`/integrations/${id}/install`), 404);

    const list = await staff.get('/platform/connectors');
    const entry = (list.body as any[]).find((c) => c.id === id);
    expect(entry).toMatchObject({ status: 'revoked', versions: [expect.objectContaining({ version: '1.0.0', status: 'approved' })] });

    const audit = await staff.get('/platform/audit');
    const actions = JSON.stringify(audit.body);
    for (const action of ['connector.registered', 'connector.approved', 'connector.revoked']) expect(actions).toContain(action);
  });

  test('new versions are registered next to the approved one', async () => {
    const staff = Api.as(await staffSession());
    version = '1.1.0';
    const registered = await staff.post('/platform/connectors', { manifestUrl });
    expectStatus(registered, 201);
    expect(registered.body).toMatchObject({ version: '1.1.0', status: 'draft' });
  });

  test('institution members cannot manage the registry', async () => {
    const admin = bank.adminApi;
    expectForbidden(await admin.get('/platform/connectors'));
    expectForbidden(await admin.post('/platform/connectors', { manifestUrl }));
    const integrator = await addMember(bank, { roles: ['integration_manager'] });
    expectForbidden(await Api.as(integrator).post(`/platform/connectors/${id}/revoke`));
  });
});
