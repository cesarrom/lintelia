import { sql } from 'drizzle-orm';
import { pgPolicy, pgRole, uuid } from 'drizzle-orm/pg-core';

/**
 * Row level security building blocks shared by every table.
 *
 * One Postgres database holds platform data (tenants, staff) and tenant data. Isolation is enforced by Postgres,
 * not by the application:
 *
 *  - `fintivio_app` is the role the API uses for tenant-scoped work. It is not a superuser and has no BYPASSRLS,
 *    so every row it touches must pass the tenant policy below. The tenant is selected per transaction with
 *    `select set_config('app.tenant_id', '<uuid>', true)` (see `apps/core/src/clients/database.client.ts`).
 *    Without that setting the policies match nothing.
 *  - `fintivio_platform` is the role used for staff/system operations (tenant directory, staff accounts).
 *    It has explicit policies on platform tables only and no grants on tenant tables.
 *
 * Both roles are created (NOLOGIN) by the bootstrap migration; environments grant LOGIN + password out of band
 * (locally `scripts/db.ts` does it). They are declared `.existing()` so drizzle-kit does not try to manage them.
 */
export const appRole = pgRole('fintivio_app').existing();
export const platformRole = pgRole('fintivio_platform').existing();

/** The tenant selected for the current transaction, or NULL when none is set. */
export const currentTenantId = sql`nullif(current_setting('app.tenant_id', true), '')::uuid`;

/**
 * `tenant_id` column for tenant-owned tables. It defaults to the tenant of the current transaction, so inserts made
 * through a tenant-scoped connection do not need to (and should not) pass it explicitly.
 * The foreign key to `tenants` is declared per table (see `tenantForeignKey`) to avoid a circular import.
 */
export const tenantIdColumn = () => uuid('tenant_id').notNull().default(currentTenantId);

/** Tenant isolation policy: `fintivio_app` sees and writes only rows of the current tenant. */
export const tenantIsolationPolicy = (table: string) =>
  pgPolicy(`${table}_tenant_isolation`, {
    as: 'permissive',
    for: 'all',
    to: appRole,
    using: sql`tenant_id = ${currentTenantId}`,
    withCheck: sql`tenant_id = ${currentTenantId}`,
  });
