import postgres from 'postgres';
import { env } from './env';

/** Restate admin SQL introspection (journals, invocations). */
export async function restateQuery<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const res = await fetch(new URL('/query', env.restateAdminUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Restate query failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { rows: T[] }).rows;
}

/**
 * Owner connection to the application database. Only for white-box security assertions (e.g. a secret is not
 * stored in plain text) and environment setup; never to set up state a user could not create through the API.
 */
export async function withOwnerDb<T>(fn: (sql: postgres.Sql) => Promise<T>, database?: string): Promise<T> {
  const url = new URL(env.ownerDatabaseUrl);
  if (database) url.pathname = `/${database}`;
  const sql = postgres(url.toString(), { max: 1, onnotice: () => { } });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}
