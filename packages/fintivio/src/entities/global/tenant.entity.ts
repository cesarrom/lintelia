import { sql } from 'drizzle-orm';
import { pgTable, varchar, jsonb, text, timestamp, uuid, pgPolicy, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { appRole, currentTenantId, platformRole } from '../rls';

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);

/**
 * A financial institution onboarded by platform staff. Platform table: managed through `fintivio_platform`.
 * `domain` is the tenant's stable key (slug), used in URLs and by the web app to pick the tenant.
 */
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  status: tenantStatusEnum('status').default('active').notNull(),
  logoUrl: varchar('logo_url', { length: 1024 }).default('').notNull(),
  pallette: jsonb('pallette').$type<{ primary: string; secondary: string; accent: string; }>().notNull(),
  /** Host names (e.g. `onboarding.bank.com`, `bank.localhost:3001`) that resolve to this tenant. */
  allowedDomains: text('allowed_domains').array().default(sql`'{}'::text[]`).notNull(),
  addressLine1: varchar('address_line_1', { length: 255 }).default('').notNull(),
  addressLine2: varchar('address_line_2', { length: 255 }).default('').notNull(),
  city: varchar('city', { length: 255 }).default('').notNull(),
  country: varchar('country', { length: 255 }).default('').notNull(),
  state: varchar('state', { length: 255 }).default('').notNull(),
  zipCode: varchar('zip_code', { length: 255 }).default('').notNull(),
  startWorkingHour: varchar('start_working_hour', { length: 255 }).default('09:00').notNull(),
  endWorkingHour: varchar('end_working_hour', { length: 255 }).default('17:00').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('tenants_domain_idx').on(table.domain),
  // Staff manage every tenant.
  pgPolicy('tenants_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
  // A tenant can read and update its own record (branding, working hours), never anyone else's.
  pgPolicy('tenants_self_select', { as: 'permissive', for: 'select', to: appRole, using: sql`${table.id} = ${currentTenantId}` }),
  pgPolicy('tenants_self_update', { as: 'permissive', for: 'update', to: appRole, using: sql`${table.id} = ${currentTenantId}`, withCheck: sql`${table.id} = ${currentTenantId}` }),
]);
