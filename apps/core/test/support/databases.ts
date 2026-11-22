import postgres from 'postgres';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';
import { createDatabases } from '../../src/clients/database.client';

const root = resolve(import.meta.dir, '../..');
for (const candidate of [join(root, '.env'), join(root, '../../.env')]) {
  if (existsSync(candidate)) { config({ path: candidate }); break; }
}

/** Same server as development, database `<name>_test` (created and migrated by `bun run db:start`). */
const toTestDb = (url: string) => {
  const u = new URL(url);
  u.pathname = `${u.pathname}_test`;
  return u.toString();
};

export const testUrls = {
  owner: toTestDb(process.env.DATABASE_OWNER_URL!),
  app: toTestDb(process.env.DATABASE_URL!),
  platform: toTestDb(process.env.DATABASE_PLATFORM_URL!),
};

/** Owner connection: ONLY for test setup/cleanup and catalog inspection, never for assertions about access. */
export const ownerSql = () => postgres(testUrls.owner, { max: 2, onnotice: () => { } });

export const testDatabases = () => createDatabases({ app: testUrls.app, platform: testUrls.platform });

export async function resetTestData() {
  const sql = ownerSql();
  try {
    await sql`truncate table tenants, platform_users cascade`;
  } finally {
    await sql.end();
  }
}
