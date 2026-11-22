/**
 * Local connectors (docs/plans/03, 08):
 *
 *   bun scripts/connectors.ts databases   create a database + role per connector (integrations/*), on the embedded Postgres
 *   bun scripts/connectors.ts register    register and approve every local connector's manifest (waits for them)
 *
 * Each connector owns its database (`connector_<id>`, role of the same name); the core never connects to it.
 * Registration here is the local shortcut for "platform staff register and approve a version" (Platform → Connectors).
 */
import postgres from 'postgres';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(import.meta.dir, '..');
const repo = resolve(root, '../..');
for (const candidate of [join(root, '.env'), join(repo, '.env')]) {
  if (existsSync(candidate)) { config({ path: candidate }); break; }
}

const ports = JSON.parse(readFileSync(join(repo, 'dev/ports.json'), 'utf8')).services as Record<string, { port: number; url?: string }>;
const snake = (id: string) => id.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
const ident = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Connectors of this repository: integrations/<dir>/package.json with `lintelia.connector`. */
export function localConnectors() {
  const dir = join(repo, 'integrations');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name, 'package.json');
    if (!existsSync(file)) return [];
    const id = JSON.parse(readFileSync(file, 'utf8')).lintelia?.connector as string | undefined;
    if (!id) return [];
    const service = ports[`connector-${id}`];
    return [{ id, dir: join(dir, name), url: service?.url ?? `http://localhost:${service?.port}` }];
  });
}

async function databases() {
  const owner = new URL(process.env.DATABASE_OWNER_URL!);
  owner.pathname = '/postgres';
  const sql = postgres(owner.toString(), { max: 1, onnotice: () => { } });
  try {
    for (const { id } of localConnectors()) {
      const name = `connector_${snake(id)}`;
      const [role] = await sql`select 1 from pg_roles where rolname = ${name}`;
      if (!role) await sql.unsafe(`create role ${ident(name)} login password ${literal(name)}`);
      const [db] = await sql`select 1 from pg_database where datname = ${name}`;
      if (!db) {
        await sql.unsafe(`create database ${ident(name)} owner ${ident(name)}`);
        console.log(`created database ${name}`);
      }
      // The core's roles have no access to connector databases.
      await sql.unsafe(`revoke all on database ${ident(name)} from public`);
    }
    console.log(`connector databases ready (${localConnectors().map((c) => c.id).join(', ') || 'none'})`);
    await sampleCoreBanking(sql, owner);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * A stand-in for an institution's own system of record, to connect with the postgres-datasource connector:
 * database `fi_core_banking` (customers, accounts, credit_scores) with the read-only login
 * `core_banking_reader` / `core-banking-reader-pw`. The e2e global setup creates the same thing.
 */
async function sampleCoreBanking(admin: postgres.Sql, owner: URL) {
  const [db] = await admin`select 1 from pg_database where datname = 'fi_core_banking'`;
  if (!db) await admin.unsafe('create database fi_core_banking');
  const [role] = await admin`select 1 from pg_roles where rolname = 'core_banking_reader'`;
  if (!role) await admin.unsafe("create role core_banking_reader login password 'core-banking-reader-pw'");
  const url = new URL(owner.toString());
  url.pathname = '/fi_core_banking';
  const sql = postgres(url.toString(), { max: 1, onnotice: () => { } });
  try {
    await sql.unsafe(`
      create table if not exists customers (
        id text primary key, full_name text not null, email text not null, date_of_birth date not null,
        country text not null, segment text not null default 'retail'
      );
      create table if not exists accounts (
        id text primary key, customer_id text not null references customers(id), kind text not null,
        balance numeric(14,2) not null, currency text not null default 'USD'
      );
      create table if not exists credit_scores (
        customer_id text primary key references customers(id), score integer not null, bureau text not null
      );
      insert into customers values
        ('C-1001', 'Ada Lovelace', 'ada@customers.example', '1985-12-10', 'GB', 'retail'),
        ('C-1002', 'Grace Hopper', 'grace@customers.example', '1970-12-09', 'US', 'private'),
        ('C-1003', 'Alan Turing', 'alan@customers.example', '1990-06-23', 'GB', 'retail')
      on conflict do nothing;
      insert into accounts values ('A-1', 'C-1001', 'checking', 2500.00, 'GBP'), ('A-2', 'C-1002', 'savings', 180000.00, 'USD')
      on conflict do nothing;
      insert into credit_scores values ('C-1001', 780, 'fake-bureau'), ('C-1002', 820, 'fake-bureau'), ('C-1003', 540, 'fake-bureau')
      on conflict do nothing;
      grant connect on database fi_core_banking to core_banking_reader;
      grant usage on schema public to core_banking_reader;
      grant select on all tables in schema public to core_banking_reader;
    `);
    console.log('sample core banking database ready (fi_core_banking, login core_banking_reader)');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function waitFor(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch { /* not yet */ }
    await Bun.sleep(500);
  }
  return false;
}

async function register() {
  const { createDatabases } = await import('../src/clients/database.client');
  const { ConnectorRegistry } = await import('../src/integrations/registry');
  const databases = createDatabases({ app: process.env.DATABASE_URL!, platform: process.env.DATABASE_PLATFORM_URL! });
  const registry = new ConnectorRegistry(databases);
  let failed = 0;
  try {
    for (const connector of localConnectors()) {
      const manifestUrl = `${connector.url}/.well-known/lintelia-connector.json`;
      if (!(await waitFor(manifestUrl, 60_000))) {
        console.error(`${connector.id}: not reachable at ${manifestUrl}`);
        failed += 1;
        continue;
      }
      // Local development: an edited manifest replaces the approved one of the same version.
      const { manifest } = await registry.register(manifestUrl, { replaceApproved: true });
      await registry.approve(manifest.id, manifest.version, 'local-development');
      console.log(`registered and approved ${manifest.id}@${manifest.version} (${manifest.components.length} components)`);
    }
  } finally {
    await databases.close();
  }
  if (failed) process.exit(1);
}

const commands: Record<string, () => Promise<void>> = { databases, register };
const command = process.argv[2];
if (!command || !commands[command]) {
  console.error(`usage: bun scripts/connectors.ts <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}
await commands[command]();
process.exit(0);
