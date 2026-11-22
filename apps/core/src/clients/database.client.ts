import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../entities';

/**
 * Database access.
 *
 * Two pools, neither of them privileged:
 *  - `app` connects as `lintelia_app`: every table it touches is filtered by row level security on `app.tenant_id`.
 *  - `platform` connects as `lintelia_platform`: tenant directory and staff accounts only (no tenant data grants).
 *
 * `tenantDatabase(tenantId)` returns a drizzle instance whose every statement runs in its own short transaction that
 * starts with `set_config('app.tenant_id', tenantId, true)` (transaction-local). Explicit `db.transaction()` blocks set
 * it once at BEGIN. This keeps the autocommit behaviour the services were written for while guaranteeing that the
 * tenant can never leak between requests sharing a pooled connection.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DriverClient = Pick<Sql, 'unsafe' | 'begin' | 'options'>;

const setTenant = (tx: postgres.TransactionSql, tenantId: string) =>
  tx`select set_config('app.tenant_id', ${tenantId}, true)`;

/** A postgres-js look-alike exposing exactly what drizzle's postgres-js session uses. */
export function tenantScopedClient(sql: Sql, tenantId: string): DriverClient {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`Invalid tenant id: ${tenantId}`);
  }

  const run = (query: string, params: any[] | undefined, options: any, asValues: boolean) =>
    sql.begin(async (tx) => {
      await setTenant(tx, tenantId);
      const pending = tx.unsafe(query, params, options);
      return asValues ? await pending.values() : await pending;
    });

  const client = {
    options: sql.options,
    unsafe(query: string, params?: any[], options?: any) {
      // drizzle either awaits the result directly or calls `.values()` on it; run lazily in both cases.
      let promise: Promise<any> | undefined;
      const lazy = () => (promise ??= run(query, params, options, false));
      return {
        values: () => run(query, params, options, true),
        then: (onFulfilled: any, onRejected: any) => lazy().then(onFulfilled, onRejected),
        catch: (onRejected: any) => lazy().catch(onRejected),
        finally: (onFinally: any) => lazy().finally(onFinally),
      };
    },
    begin(...args: any[]) {
      const fn = args[args.length - 1] as (tx: postgres.TransactionSql) => unknown;
      const options = args.length > 1 ? args[0] : undefined;
      const body = async (tx: postgres.TransactionSql) => {
        await setTenant(tx, tenantId);
        return fn(tx);
      };
      return options ? sql.begin(options, body) : sql.begin(body);
    },
  };

  return client as unknown as DriverClient;
}

export function createDatabases(urls: { app: string; platform: string }) {
  const appSql = postgres(urls.app, { max: 10, onnotice: () => { } });
  const platformSql = postgres(urls.platform, { max: 5, onnotice: () => { } });

  const platform = drizzle({ client: platformSql, schema });
  const tenantCache = new Map<string, TenantDatabase>();

  const forTenant = (tenantId: string): TenantDatabase => {
    let db = tenantCache.get(tenantId);
    if (!db) {
      db = drizzle({ client: tenantScopedClient(appSql, tenantId) as Sql, schema });
      tenantCache.set(tenantId, db);
    }
    return db;
  };

  return {
    platform,
    forTenant,
    /** LISTEN on a channel of the platform database (cache invalidation across API instances). */
    listen(channel: string, onMessage: (payload: string) => void) {
      return platformSql.listen(channel, onMessage);
    },
    notify(channel: string, payload = '') {
      return platformSql.notify(channel, payload);
    },
    async close() {
      await Promise.all([appSql.end({ timeout: 5 }), platformSql.end({ timeout: 5 })]);
    },
  };
}

export type PlatformDatabase = PostgresJsDatabase<typeof schema>;
export type TenantDatabase = PostgresJsDatabase<typeof schema>;
export type Databases = ReturnType<typeof createDatabases>;
