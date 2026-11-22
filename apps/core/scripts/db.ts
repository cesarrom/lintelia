/**
 * Local database tooling (embedded Postgres from the `embedded-postgres` npm package, no Docker needed).
 *
 *   bun run db:start     start Postgres in the foreground; creates + migrates the dev and test databases on first run
 *   bun run db:migrate   apply migrations to a running server (dev + test databases)
 *   bun run db:seed      insert development data (staff account, demo tenants, users)
 *   bun run db:reset     drop and recreate the dev database, migrate and seed
 *
 * Postgres refuses to run as root: run these as a normal user.
 * Connection settings come from apps/core/.env (see .env.example):
 *   DATABASE_OWNER_URL     owner/superuser, used ONLY here for migrations (never by the app)
 *   DATABASE_URL           lintelia_app (tenant-scoped, row level security)
 *   DATABASE_PLATFORM_URL  lintelia_platform (tenant directory, staff)
 */
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

const root = resolve(import.meta.dir, '..');
for (const candidate of [join(root, '.env'), join(root, '../../.env')]) {
  if (existsSync(candidate)) { config({ path: candidate }); break; }
}

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (copy apps/core/.env.example to apps/core/.env)`);
  return value;
};

const ownerUrl = new URL(required('DATABASE_OWNER_URL'));
const appUrl = new URL(required('DATABASE_URL'));
const platformUrl = new URL(required('DATABASE_PLATFORM_URL'));
const dataDir = resolve(root, process.env.EMBEDDED_PG_DIR ?? '.data/postgres');
const dbName = ownerUrl.pathname.slice(1);
const testDbName = `${dbName}_test`;
const migrationsFolder = join(root, 'drizzle');

const urlFor = (url: URL, database: string) => {
  const u = new URL(url.toString());
  u.pathname = `/${database}`;
  return u.toString();
};

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const ident = (value: string) => `"${value.replaceAll('"', '""')}"`;

async function withSql<T>(url: string, fn: (sql: postgres.Sql) => Promise<T>) {
  const sql = postgres(url, { max: 1, onnotice: () => { } });
  try { return await fn(sql); } finally { await sql.end({ timeout: 5 }); }
}

async function ensureDatabase(name: string) {
  await withSql(urlFor(ownerUrl, 'postgres'), async (sql) => {
    const [row] = await sql`select 1 from pg_database where datname = ${name}`;
    if (!row) {
      await sql.unsafe(`create database ${ident(name)}`);
      console.log(`created database ${name}`);
    }
  });
}

async function migrateDatabase(name: string) {
  await withSql(urlFor(ownerUrl, name), async (sql) => {
    await migrate(drizzle({ client: sql }), { migrationsFolder });
  });
  console.log(`migrated ${name}`);
}

/** Roles are created NOLOGIN by the bootstrap migration; give them LOGIN + the passwords from the URLs. */
async function enableRoleLogins() {
  await withSql(urlFor(ownerUrl, dbName), async (sql) => {
    for (const url of [appUrl, platformUrl]) {
      const role = decodeURIComponent(url.username);
      const password = decodeURIComponent(url.password);
      await sql.unsafe(`alter role ${ident(role)} with login password ${literal(password)}`);
    }
  });
}

async function prepare() {
  for (const name of [dbName, testDbName]) {
    await ensureDatabase(name);
    await migrateDatabase(name);
  }
  await enableRoleLogins();
}

/** True when the dev database has neither tenants nor staff (fresh, or a previous seed failed). */
async function isEmpty() {
  return withSql(urlFor(ownerUrl, dbName), async (sql) => {
    const [row] = await sql`select (select count(*) from tenants) + (select count(*) from platform_users) as n`;
    return Number(row.n) === 0;
  });
}

async function reset() {
  await withSql(urlFor(ownerUrl, 'postgres'), async (sql) => {
    await sql.unsafe(`drop database if exists ${ident(dbName)} with (force)`);
  });
  await prepare();
  await seed();
}

async function seed() {
  const { seedDevelopmentData } = await import('./seed');
  await seedDevelopmentData({ app: appUrl.toString(), platform: platformUrl.toString() });
}

async function start() {
  const port = Number(ownerUrl.port || 5432);
  const firstRun = !existsSync(join(dataDir, 'PG_VERSION'));

  mkdirSync(dataDir, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port,
    user: decodeURIComponent(ownerUrl.username),
    password: decodeURIComponent(ownerUrl.password),
    persistent: true,
    onLog: () => { },
    onError: (message) => console.error(String(message).trim()),
  });

  if (firstRun) {
    console.log(`initialising Postgres data directory at ${dataDir}`);
    await pg.initialise();
  }
  await pg.start();
  console.log(`Postgres listening on localhost:${port}`);

  await prepare();
  if (process.argv.includes('--seed') || await isEmpty()) {
    await seed();
  }

  console.log(`ready: ${dbName} (dev) and ${testDbName} (tests). Ctrl+C to stop.`);

  const stop = async () => {
    console.log('stopping Postgres...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await new Promise(() => { });
}

const command = process.argv[2];
const commands: Record<string, () => Promise<unknown>> = {
  start,
  migrate: prepare,
  setup: prepare,
  seed,
  reset,
};

if (!command || !commands[command]) {
  console.error(`usage: bun scripts/db.ts <${Object.keys(commands).join('|')}>`);
  process.exit(1);
}

commands[command]().then(
  () => { if (command !== 'start') process.exit(0); },
  (error) => { console.error(error); process.exit(1); },
);
