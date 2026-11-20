import { sql } from 'drizzle-orm';
import { pgTable, varchar, uuid, timestamp, pgPolicy, foreignKey } from 'drizzle-orm/pg-core';
import { platformRole } from '../rls';
import { tenants } from './tenant.entity';

/**
 * Public keys of published forms. Anonymous visitors of an embedded form only know the key, so the API finds the
 * tenant here (platform connection) before switching to the tenant's row-level-security context.
 */
export const publicFormKeys = pgTable('public_form_keys', {
  key: varchar('key', { length: 64 }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  formId: uuid('form_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'public_form_keys_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  pgPolicy('public_form_keys_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);
