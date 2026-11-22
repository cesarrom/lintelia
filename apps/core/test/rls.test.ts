/**
 * Row level security: tenant isolation is enforced by Postgres for the role the API uses (lintelia_app).
 * Assertions run through the restricted roles; the owner connection is only used to prepare and inspect.
 * Requires the local database (`bun run db:start`).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { platformUsers, roles, sysKeyValues, sysWorkflows, tenants, userRoles, users } from '../src/entities';
import { provisionTenant } from '../src/tenancy/provisioning';
import { ownerSql, resetTestData, testDatabases } from './support/databases';

const databases = testDatabases();
let tenantA: typeof tenants.$inferSelect;
let tenantB: typeof tenants.$inferSelect;
let userB: typeof users.$inferSelect;

const workflow = (name: string) => ({ name, description: name, yaml: 'name: x', createdBy: 'test' });

/** Expect a query to fail with a Postgres error matching `pattern` (drizzle wraps it as `cause`). */
async function expectDbError(query: () => Promise<unknown>, pattern: RegExp) {
  let error: any;
  try {
    await query();
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  expect(String(error?.cause?.message ?? error?.message)).toMatch(pattern);
}

beforeAll(async () => {
  await resetTestData();
  tenantA = await provisionTenant(databases, { name: 'Tenant A', domain: 'tenant-a' });
  tenantB = await provisionTenant(databases, { name: 'Tenant B', domain: 'tenant-b' });
  await databases.forTenant(tenantA.id).insert(sysWorkflows).values(workflow('a-workflow'));
  await databases.forTenant(tenantB.id).insert(sysWorkflows).values(workflow('b-workflow'));
  [userB] = await databases.forTenant(tenantB.id).insert(users).values({ email: 'b@example.com' }).returning();
});

afterAll(async () => {
  await databases.close();
});

describe('schema guarantees', () => {
  test('every table with tenant_id has RLS enabled and forced, a lintelia_app policy and grants', async () => {
    const owner = ownerSql();
    try {
      const rows = await owner<{ table: string; enabled: boolean; forced: boolean; policies: number; canSelect: boolean }[]>`
        select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
               (select count(*)::int from pg_policies p where p.tablename = c.relname and 'lintelia_app' = any(p.roles)) as policies,
               has_table_privilege('lintelia_app', c.oid, 'SELECT') as "canSelect"
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and exists (select 1 from information_schema.columns col where col.table_name = c.relname and col.column_name = 'tenant_id')`;
      expect(rows.length).toBeGreaterThan(15);
      // Platform lookup tables that reference a tenant but are only read through the platform connection
      // (e.g. resolving a public form key to its tenant before any tenant context exists).
      const PLATFORM_LOOKUPS = ['public_form_keys', 'support_grants', 'platform_audit_events', 'connector_installation_index', 'api_client_index', 'platform_mfa_factors', 'custom_domains', 'platform_settings', 'sso_organization_index'];
      const broken = rows.filter((r) => !PLATFORM_LOOKUPS.includes(r.table) && (!r.enabled || !r.forced || r.policies === 0 || !r.canSelect));
      expect(broken).toEqual([]);
    } finally {
      await owner.end();
    }
  });

  test('the application roles are neither superusers nor exempt from RLS', async () => {
    const owner = ownerSql();
    try {
      const rows = await owner`select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('lintelia_app', 'lintelia_platform')`;
      expect(rows.length).toBe(2);
      for (const role of rows) {
        expect(role.rolsuper).toBe(false);
        expect(role.rolbypassrls).toBe(false);
      }
    } finally {
      await owner.end();
    }
  });
});

describe('tenant isolation (lintelia_app)', () => {
  test('a tenant only reads its own rows', async () => {
    const a = await databases.forTenant(tenantA.id).select({ name: sysWorkflows.name }).from(sysWorkflows);
    const b = await databases.forTenant(tenantB.id).select({ name: sysWorkflows.name }).from(sysWorkflows);
    expect(a.map((r) => r.name)).toEqual(['a-workflow']);
    expect(b.map((r) => r.name)).toEqual(['b-workflow']);
  });

  test('tenant_id defaults to the current tenant on insert', async () => {
    const [row] = await databases.forTenant(tenantA.id).insert(sysKeyValues).values({ key: 'k', value: 'v', createdBy: 't' }).returning();
    expect(row.tenantId).toBe(tenantA.id);
  });

  test('writing a row for another tenant is rejected', async () => {
    const attempt = databases.forTenant(tenantA.id).insert(sysKeyValues).values({ tenantId: tenantB.id, key: 'k', value: 'v', createdBy: 't' });
    await expectDbError(() => attempt.execute(), /row-level security/);
  });

  test("another tenant's rows cannot be updated or deleted, even by id", async () => {
    const dbA = databases.forTenant(tenantA.id);
    const updated = await dbA.update(users).set({ name: 'pwned' }).where(eq(users.id, userB.id)).returning();
    const deleted = await dbA.delete(users).where(eq(users.id, userB.id)).returning();
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
    const [stillThere] = await databases.forTenant(tenantB.id).select().from(users).where(eq(users.id, userB.id));
    expect(stillThere.name).not.toBe('pwned');
  });

  test("rows cannot reference another tenant's rows (composite foreign keys)", async () => {
    const dbA = databases.forTenant(tenantA.id);
    const [adminRoleA] = await dbA.select().from(roles).where(eq(roles.key, 'admin'));
    const attempt = dbA.insert(userRoles).values({ userId: userB.id, roleId: adminRoleA.id });
    await expectDbError(() => attempt.execute(), /foreign key/);
  });

  test('a tenant sees only its own tenant record', async () => {
    const visible = await databases.forTenant(tenantA.id).select({ domain: tenants.domain }).from(tenants);
    expect(visible.map((t) => t.domain)).toEqual(['tenant-a']);
    const changed = await databases.forTenant(tenantA.id).update(tenants).set({ name: 'hijacked' }).where(eq(tenants.id, tenantB.id)).returning();
    expect(changed).toEqual([]);
  });

  test('the tenant context never leaks between pooled connections', async () => {
    const runs = Array.from({ length: 40 }, (_, i) => {
      const tenant = i % 2 === 0 ? tenantA : tenantB;
      return databases.forTenant(tenant.id).select({ tenantId: sysWorkflows.tenantId }).from(sysWorkflows)
        .then((rows) => rows.every((r) => r.tenantId === tenant.id) && rows.length === 1);
    });
    expect((await Promise.all(runs)).every(Boolean)).toBe(true);
  });

  test('explicit transactions carry the tenant context', async () => {
    const names = await databases.forTenant(tenantB.id).transaction(async (tx) => {
      await tx.insert(sysKeyValues).values({ key: 'tx', value: '1', createdBy: 't' });
      return tx.select({ key: sysKeyValues.key, tenantId: sysKeyValues.tenantId }).from(sysKeyValues);
    });
    expect(names).toEqual([{ key: 'tx', tenantId: tenantB.id }]);
  });
});

describe('role separation', () => {
  test('lintelia_app cannot read staff accounts', async () => {
    await expectDbError(() => databases.forTenant(tenantA.id).select().from(platformUsers).execute(), /permission denied/);
  });

  test('lintelia_platform cannot read tenant data', async () => {
    await expectDbError(() => databases.platform.select().from(users).execute(), /permission denied/);
  });

  test('lintelia_app without a tenant context sees nothing', async () => {
    const raw = (await import('postgres')).default;
    const { testUrls } = await import('./support/databases');
    const app = raw(testUrls.app, { max: 1 });
    try {
      const [{ count }] = await app`select count(*)::int as count from sys_workflows`;
      expect(count).toBe(0);
      // postgres-js queries are lazy thenables: wrap in an async function so the query actually runs.
      await expect((async () => app`create table evil (x int)`)()).rejects.toThrow(/permission denied/);
    } finally {
      await app.end();
    }
  });

  test('deleting a tenant removes its data (cascade)', async () => {
    const temp = await provisionTenant(databases, { name: 'Temp', domain: 'temp-tenant' });
    await databases.forTenant(temp.id).insert(sysWorkflows).values(workflow('temp'));
    await databases.platform.delete(tenants).where(eq(tenants.id, temp.id));
    const owner = ownerSql();
    try {
      const [{ count }] = await owner`select count(*)::int as count from sys_workflows where tenant_id = ${temp.id}`;
      expect(count).toBe(0);
    } finally {
      await owner.end();
    }
  });
});
