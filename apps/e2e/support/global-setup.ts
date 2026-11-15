import { env } from './env';
import { rmSync } from 'node:fs';
import { withOwnerDb } from './infra';
import { STAFF_SESSION_FILE, staffSession } from './factories';

const hint = 'Start the local stack first: `bun run stack` (see readme.md), or use `bun run stack:test`.';

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    throw new Error(`E2E preflight: ${name} is not reachable (${(error as Error).message}). ${hint}`);
  }
}

/**
 * A stand-in for a financial institution's own system of record: a separate database with a read-only login role,
 * which tenants connect as an external data source (flows INT-01..03, SCN-04).
 */
async function ensureExternalCoreBankingDatabase() {
  const { database, user, password } = env.externalDatabase;
  await withOwnerDb(async (sql) => {
    const [exists] = await sql`select 1 from pg_database where datname = ${database}`;
    if (!exists) await sql.unsafe(`create database ${database}`);
    const [role] = await sql`select 1 from pg_roles where rolname = ${user}`;
    if (!role) await sql.unsafe(`create role ${user} login password '${password}'`);
  }, 'postgres');

  await withOwnerDb(async (sql) => {
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
      insert into accounts values
        ('A-1', 'C-1001', 'checking', 2500.00, 'GBP'),
        ('A-2', 'C-1002', 'savings', 180000.00, 'USD')
      on conflict do nothing;
      insert into credit_scores values ('C-1001', 780, 'fake-bureau'), ('C-1002', 820, 'fake-bureau'), ('C-1003', 540, 'fake-bureau')
      on conflict do nothing;
      grant connect on database ${database} to ${user};
      grant usage on schema public to ${user};
      grant select on all tables in schema public to ${user};
    `);
  }, database);
}

export default async function globalSetup() {
  await check('API', async () => {
    const res = await fetch(new URL('/health', env.apiUrl));
    if (!res.ok) throw new Error(`health returned ${res.status}`);
  });
  await check('Restate admin API', async () => {
    const res = await fetch(new URL('/health', env.restateAdminUrl));
    if (!res.ok) throw new Error(`health returned ${res.status}`);
  });
  await check('Local mailbox (fake-services/mailbox)', async () => {
    const res = await fetch(new URL('/__health', env.mailboxUrl));
    if (!res.ok) throw new Error(`health returned ${res.status}`);
  });
  await check('Seeded platform staff account (password + TOTP)', async () => {
    // One sign-in for the whole run, shared by the workers through a file (see staffSession).
    rmSync(STAFF_SESSION_FILE, { force: true });
    await staffSession();
  });
  await check('Database (owner connection)', ensureExternalCoreBankingDatabase);
}
