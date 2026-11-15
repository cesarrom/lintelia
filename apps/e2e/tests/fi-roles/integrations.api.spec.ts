import { test, expect } from '@playwright/test';
import { Api, expectForbidden, expectStatus } from '../../support/api';
import { addMember, createTenant, deleteTenant, type TenantHandle } from '../../support/factories';
import { env } from '../../support/env';
import { withOwnerDb } from '../../support/infra';
import { emailsTo } from '../../support/mailbox';
import { waitForCase } from '../../support/scenario';
import { publishWorkflow } from '../../support/workflows';
import { connect, coreBankingDatabase, mailboxSmtp, updateSettings } from '../../support/connectors';
import type { Member } from '../../support/scenario';

/**
 * INT-*: institutions connect their own systems through connectors (docs/plans/03): separate services with their own
 * pages and databases. The "core banking" database is a real Postgres database created by the global setup, reachable
 * with a read-only login; e-mail goes to the local mailbox acting as the bank's SMTP server.
 */
let bank: TenantHandle;
let integrator: Member;
let designer: Member;
let api: Api;

test.beforeAll(async () => {
  bank = await createTenant();
  integrator = await addMember(bank, { roles: ['integration_manager'], label: 'integrator' });
  designer = await addMember(bank, { roles: ['flow_designer'], label: 'designer' });
  api = Api.as(integrator);
});
test.afterAll(async () => { await deleteTenant(bank); });

const queryWorkflow = (connectionId: string, query = 'select customer_id, score from credit_scores where customer_id = :customerId') => `schemaVersion: "1"
name: Credit lookup ${Date.now()}-${Math.random().toString(36).slice(2, 6)}
description: reads the credit score of a customer from core banking
version: 1
triggers: []
inputs:
  - { id: customerId, name: customerId, type: string, required: true }
steps:
  - id: start
    name: Start
    type: start
    events:
      - { name: finished, outputs: [], next: [lookup] }
  - id: lookup
    name: Lookup
    type: "connector:postgres-datasource/query.run"
    config:
      connection: ${connectionId}
      query: "${query}"
      params: { customerId: "{{input.customerId}}" }
    events:
      - { name: success, outputs: [], next: [found] }
      - { name: failed, outputs: [], next: [failed] }
  - id: found
    name: Found
    type: case.decision
    config: { status: completed, outcome: looked_up }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
  - id: failed
    name: Failed
    type: case.decision
    config: { status: closed, outcome: lookup_failed }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
`;

/** Run a case on a workflow and return it once it ended, with the output of every step. */
async function runCase(workflowId: string, inputs: Record<string, unknown>) {
  const created = await bank.adminApi.post('/cases', { workflowId, inputs });
  expectStatus(created, 201);
  return waitForCase(bank.adminApi, created.body.id, (c) => ['completed', 'closed', 'failed', 'approved', 'rejected'].includes(c.status), 30_000);
}

test.describe('INT-01 Connect an external data source and test it', { tag: ['@integration-manager', '@INT-01', '@CON-01'] }, () => {
  test('the catalogue lists the approved connectors with what they can do', async () => {
    const catalog = await api.get('/integrations/catalog');
    expectStatus(catalog, 200);
    const ids = (catalog.body as any[]).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['postgres-datasource', 'smtp-mailer']));
    const postgres = (catalog.body as any[]).find((c) => c.id === 'postgres-datasource');
    expect(postgres.components.map((c: any) => c.key)).toContain('query.run');
    expect(postgres.scopes).toContain('installation:write');
  });

  test("the connector's page checks the credentials before the connection becomes active", async () => {
    const wrong = await connect(api, 'postgres-datasource', coreBankingDatabase({ password: 'not-the-password' }));
    expect(wrong.result.saved).toBe(false);
    expect(wrong.result.error).toMatch(/could not connect/i);
    expect(wrong.result.html).not.toContain('not-the-password');
    const pending = ((await api.get('/integrations')).body as any[]).find((c) => c.id === wrong.installationId);
    expect(pending.status).toBe('pending');

    const right = await connect(api, 'postgres-datasource', coreBankingDatabase());
    expect(right.result.error).toBeNull();
    expect(right.result.saved).toBe(true);
    const active = ((await api.get('/integrations')).body as any[]).find((c) => c.id === right.installationId);
    expect(active).toMatchObject({ status: 'active', connectorId: 'postgres-datasource' });
    expect(active.configSummary.access).toBe('read-only');
  });

  test('only integrations:manage holders connect systems', async () => {
    expectForbidden(await Api.as(designer).post('/integrations/postgres-datasource/install'));
    const reviewer = await addMember(bank, { roles: ['reviewer'] });
    expectForbidden(await Api.as(reviewer).get('/integrations'));
  });

  test('a hand-off code works once', async () => {
    const started = await api.post('/integrations/postgres-datasource/install');
    expectStatus(started, 201);
    expect((await fetch(started.body.url)).status).toBe(200);
    const again = await fetch(started.body.url);
    expect(again.status).toBe(400);
    expect(await again.text()).toMatch(/expired or was already used/);
  });
});

test.describe('INT-05 Secrets are write-only and encrypted at rest', { tag: ['@integration-manager', '@INT-05'] }, () => {
  test('no API response or page contains the secret, and it is never stored in the core', async () => {
    const secret = `pw-${Date.now()}-never-shown`;
    const { installationId, result } = await connect(api, 'smtp-mailer', mailboxSmtp({ password: secret }));
    expect(result.saved).toBe(true);
    const bodies = [(await api.get('/integrations')).body, (await api.get('/integrations/catalog')).body, (await bank.adminApi.get('/audit')).body];
    for (const body of bodies) expect(JSON.stringify(body)).not.toContain(secret);

    // Reopening the settings shows that a password is set, never the password.
    const session = await api.post(`/integrations/${installationId}/setup-session`);
    const html = await (await fetch(session.body.url)).text();
    expect(html).not.toContain(secret);
    expect(html).toMatch(/set \d{4}-\d{2}-\d{2}\. Leave empty to keep it/);

    const inCore = await withOwnerDb(async (sql) => {
      const columns = await sql<{ table_name: string; column_name: string }[]>`
        select table_name, column_name from information_schema.columns
        where table_schema = 'public' and data_type in ('text', 'character varying', 'json', 'jsonb')`;
      const found: string[] = [];
      for (const { table_name, column_name } of columns) {
        const [row] = await sql.unsafe(`select count(*)::int as n from "${table_name}" where "${column_name}"::text like $1`, [`%${secret}%`]);
        if (row.n > 0) found.push(`${table_name}.${column_name}`);
      }
      return found;
    });
    expect(inCore).toEqual([]);

    // The connector keeps it encrypted (AES-256-GCM with a per-installation data key).
    const inConnector = await withOwnerDb(async (sql) => {
      const [plain] = await sql`select count(*)::int as n from sdk_secrets where position(convert_to(${secret}, 'UTF8') in ciphertext) > 0`;
      const [stored] = await sql`select count(*)::int as n from sdk_secrets where installation_id = ${installationId} and name = 'password'`;
      const [config] = await sql`select count(*)::int as n from sdk_installations where config::text like ${`%${secret}%`}`;
      return { plain: plain.n, stored: stored.n, config: config.n };
    }, 'connector_smtp_mailer');
    expect(inConnector).toEqual({ plain: 0, stored: 1, config: 0 });
  });

  test('changing a secret is audited by name, never by value', async () => {
    const { installationId } = await connect(api, 'smtp-mailer', mailboxSmtp());
    const updated = await updateSettings(api, installationId, mailboxSmtp({ password: 'rotated-secret-value' }));
    expect(updated.saved).toBe(true);
    const audit = await bank.adminApi.get('/audit?action=integration.secrets_changed');
    expectStatus(audit, 200);
    const entries = (audit.body.items ?? audit.body) as any[];
    const entry = entries.find((e) => e.target?.id === installationId || e.targetId === installationId);
    expect(entry, JSON.stringify(entries).slice(0, 400)).toBeTruthy();
    expect(JSON.stringify(entry)).toContain('password');
    expect(JSON.stringify(entries)).not.toContain('rotated-secret-value');
  });
});

test.describe('INT-02 Connected systems become workflow components', { tag: ['@integration-manager', '@INT-02', '@CON-03'] }, () => {
  test('a connector component appears with the connection and disappears with it', async () => {
    const other = await createTenant();
    try {
      const otherIntegrator = await addMember(other, { roles: ['integration_manager'] });
      const otherDesigner = await addMember(other, { roles: ['flow_designer'] });
      const components = async () => ((await Api.as(otherDesigner).get('/workflow-components')).body as any[]).map((c) => c.type);
      expect(await components()).not.toContain('connector:postgres-datasource/query.run');
      const { installationId } = await connect(Api.as(otherIntegrator), 'postgres-datasource', coreBankingDatabase());
      expect(await components()).toContain('connector:postgres-datasource/query.run');
      expect(await components()).toEqual(expect.arrayContaining(['start', 'end', 'review', 'conditional']));
      expectStatus(await Api.as(otherIntegrator).delete(`/integrations/${installationId}`), 200);
      expect(await components()).not.toContain('connector:postgres-datasource/query.run');
    } finally {
      await deleteTenant(other);
    }
  });

  test('a connection used by a published workflow cannot be removed; once retired, the connector deletes its secrets', async () => {
    const { installationId } = await connect(api, 'postgres-datasource', coreBankingDatabase());
    const workflowId = await publishWorkflow(Api.as(designer), queryWorkflow(installationId));
    const blocked = await api.delete(`/integrations/${installationId}`);
    expectStatus(blocked, 409);
    expect(JSON.stringify(blocked.body)).toMatch(/published workflows/);

    expectStatus(await Api.as(designer).post(`/workflows/${workflowId}/retire`), 200);
    expectStatus(await api.delete(`/integrations/${installationId}`), 200);
    // The connector received the `uninstalled` lifecycle event: settings, data key and secrets are gone.
    const left = await withOwnerDb(async (sql) => {
      const [installations] = await sql`select count(*)::int as n from sdk_installations where id = ${installationId}`;
      const [keys] = await sql`select count(*)::int as n from sdk_data_keys where installation_id = ${installationId}`;
      const [secrets] = await sql`select count(*)::int as n from sdk_secrets where installation_id = ${installationId}`;
      return installations.n + keys.n + secrets.n;
    }, 'connector_postgres_datasource');
    expect(left).toBe(0);
  });

  test('a workflow cannot be published with a connection that is not set up', async () => {
    const started = await api.post('/integrations/postgres-datasource/install');
    const draft = await Api.as(designer).post('/workflows', { yaml: queryWorkflow(started.body.installationId) });
    expectStatus(draft, 201);
    const published = await Api.as(designer).post(`/workflows/${draft.body.id}/publish`);
    expectStatus(published, 422);
    expect(JSON.stringify(published.body)).toMatch(/not set up yet/);
  });
});

test.describe("INT-03 Use the institution's data in a workflow", { tag: ['@integration-manager', '@INT-03', '@CON-02'] }, () => {
  let connectionId: string;
  test.beforeAll(async () => {
    connectionId = (await connect(api, 'postgres-datasource', coreBankingDatabase())).installationId;
  });

  test('the query runs with bound parameters and returns the rows', async () => {
    const workflowId = await publishWorkflow(Api.as(designer), queryWorkflow(connectionId));
    const kase = await runCase(workflowId, { customerId: 'C-1001' });
    expect(kase.status).toBe('completed');
    expect(kase.outcome).toBe('looked_up');
    // Reviewers see what was looked up next to the calculations.
    const lookup = kase.calculations.find((c: any) => c.step === 'lookup');
    expect(lookup.values).toMatchObject({ rowCount: 1, rows: [{ customer_id: 'C-1001', score: 780 }] });
  });

  test('input cannot change the query (no SQL injection)', async () => {
    const workflowId = await publishWorkflow(Api.as(designer), queryWorkflow(connectionId));
    const kase = await runCase(workflowId, { customerId: "x' or '1'='1" });
    expect(kase.status).toBe('completed');
    expect(kase.calculations.find((c: any) => c.step === 'lookup').values).toMatchObject({ rowCount: 0, rows: [] });
  });

  test('queries cannot change data on a read-only connection', async () => {
    const workflowId = await publishWorkflow(Api.as(designer), queryWorkflow(connectionId, 'delete from credit_scores where customer_id = :customerId'));
    const kase = await runCase(workflowId, { customerId: 'C-1003' });
    expect(kase.outcome).toBe('lookup_failed');
    expect(JSON.stringify(kase)).toMatch(/read-only transaction/);
    const [row] = await withOwnerDb((sql) => sql`select count(*)::int as n from credit_scores where customer_id = 'C-1003'`, env.externalDatabase.database);
    expect(row.n).toBe(1);
  });
});

test.describe("INT-04 Send e-mail through the institution's own provider", { tag: ['@integration-manager', '@INT-04', '@CON-02'] }, () => {
  test("the e-mail step sends through the institution's SMTP server and leaves a record on the case", async () => {
    const from = `no-reply-${Date.now()}@${bank.key}.example`;
    const { installationId, result } = await connect(api, 'smtp-mailer', mailboxSmtp({ fromAddress: from }));
    expect(result.saved).toBe(true);
    const to = `welcome-${Date.now()}@customers.example`;
    const workflowId = await publishWorkflow(Api.as(designer), `schemaVersion: "1"
name: Welcome mail ${Date.now()}
description: welcome e-mail from the bank's own server
version: 1
triggers: []
inputs:
  - { id: fullName, name: fullName, type: string, required: true }
  - { id: email, name: email, type: string, required: true }
steps:
  - id: start
    name: Start
    type: start
    events:
      - { name: finished, outputs: [], next: [mail] }
  - id: mail
    name: Welcome mail
    type: "connector:smtp-mailer/email.send"
    config:
      connection: ${installationId}
      subject: "Welcome {{input.fullName}}"
      body: "Hello {{input.fullName}}, your reference is {{case.reference}}."
      input: { to: "{{input.email}}" }
    events:
      - { name: sent, outputs: [], next: [done] }
      - { name: failed, outputs: [], next: [done] }
  - id: done
    name: Done
    type: case.decision
    config: { status: completed }
    isTerminal: true
    events:
      - { name: done, outputs: [], next: [] }
`);
    const kase = await runCase(workflowId, { fullName: 'Ada Lovelace', email: to });
    expect(kase.status).toBe('completed');
    await expect.poll(async () => (await emailsTo({ to })).length, { timeout: 10_000 }).toBe(1);
    const [mail] = await emailsTo({ to });
    expect(mail.from).toContain(from);
    expect(mail.subject).toBe('Welcome Ada Lovelace');
    expect(mail.text).toContain(kase.reference);
    const withRecords = await bank.adminApi.get(`/cases/${kase.id}`);
    expect(withRecords.body.records).toEqual([expect.objectContaining({ type: 'message', status: 'sent', connectorId: 'smtp-mailer' })]);
  });

  test('wrong SMTP credentials are refused when connecting', async () => {
    const { result } = await connect(api, 'smtp-mailer', mailboxSmtp({ password: 'wrong' }));
    expect(result.saved).toBe(false);
    expect(result.error).toMatch(/invalid username or password/i);
  });
});
