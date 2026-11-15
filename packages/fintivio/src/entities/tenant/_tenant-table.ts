import { foreignKey, unique, type PgColumn } from 'drizzle-orm/pg-core';
import { tenants } from '../global/tenant.entity';
import { tenantIsolationPolicy } from '../rls';

type TenantScoped = { tenantId: PgColumn; id: PgColumn };

/**
 * Constraints every tenant-owned table gets:
 *  - `tenant_id` references `tenants` (rows disappear with their tenant),
 *  - `(tenant_id, id)` is unique so children can use composite foreign keys. Foreign key checks bypass RLS, so a plain
 *    `parent_id` FK would let one tenant point at another tenant's row; the composite key makes that impossible,
 *  - the tenant isolation policy for `fintivio_app`.
 */
export const tenantTable = <T extends TenantScoped>(name: string, table: T) => [
  foreignKey({ name: `${name}_tenant_fk`, columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  unique(`${name}_tenant_id_id_key`).on(table.tenantId, table.id),
  tenantIsolationPolicy(name),
];
