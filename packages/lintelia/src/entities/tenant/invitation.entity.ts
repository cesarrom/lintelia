import { pgTable, uuid, varchar, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysInvitations = pgTable('sys_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  email: varchar('email').notNull(),
  roleId: varchar('role_id').notNull(),
  data: jsonb('data').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_invitations', table),
  // One pending invitation per e-mail per tenant (was globally unique when each tenant had its own database).
  uniqueIndex('sys_invitations_tenant_email_idx').on(table.tenantId, table.email),
]);
