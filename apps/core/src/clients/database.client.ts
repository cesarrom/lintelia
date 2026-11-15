import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../constants';
import * as globals from '../entities/globals';
import * as tenant from '../entities/tenants';

const sql = postgres(env.DATABASE_CORE_URL);
const db = drizzle({
  client: sql,
  schema: globals,
});

export const globalDatabase = () => db;

export const tenantDatabase = (url: string) => {
  const sql = postgres(url);
  const db = drizzle({
    client: sql,
    schema: tenant,
  });

  return db;
}

export type GlobalDatabase = typeof db;
export type TenantDatabase = ReturnType<typeof tenantDatabase>