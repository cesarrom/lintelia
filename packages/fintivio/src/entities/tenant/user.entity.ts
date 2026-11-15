import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, pgEnum, uniqueIndex, text, primaryKey, foreignKey, boolean } from 'drizzle-orm/pg-core';
import { tenantIdColumn, tenantIsolationPolicy } from '../rls';
import { tenantTable } from './_tenant-table';
import { tenants } from '../global/tenant.entity';

/** `member`: staff of the financial institution. `client`: the institution's end users going through flows. */
export const userKindEnum = pgEnum('user_kind', ['member', 'client']);
export const userStatusEnum = pgEnum('user_status', ['invited', 'active', 'disabled']);

/** People that belong to a tenant. Identities are tenant-scoped: the same e-mail in two tenants is two users. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  email: varchar('email', { length: 320 }).notNull(),
  name: varchar('name', { length: 255 }).default('').notNull(),
  givenName: varchar('given_name', { length: 255 }),
  familyName: varchar('family_name', { length: 255 }),
  picture: varchar('picture', { length: 1024 }),
  kind: userKindEnum('kind').default('member').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  /** Null for users that have not set a password yet (invited) or that sign in through an external provider. */
  passwordHash: varchar('password_hash', { length: 512 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('users', table),
  uniqueIndex('users_tenant_email_idx').on(table.tenantId, sql`lower(${table.email})`),
]);

/** Tenant-defined roles. `key` is the stable identifier referenced by workflows (`allowedRoles`) and invitations. */
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  key: varchar('key', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1024 }).default('').notNull(),
  permissions: text('permissions').array().default(sql`'{}'::text[]`).notNull(),
  /** System roles come from the catalogue (packages/fintivio authorization.schema.ts) and cannot be edited. */
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('roles', table),
  uniqueIndex('roles_tenant_key_idx').on(table.tenantId, table.key),
]);

export const userRoles = pgTable('user_roles', {
  tenantId: tenantIdColumn(),
  userId: uuid('user_id').notNull(),
  roleId: uuid('role_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: 'user_roles_pk', columns: [table.tenantId, table.userId, table.roleId] }),
  foreignKey({ name: 'user_roles_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ name: 'user_roles_user_fk', columns: [table.tenantId, table.userId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
  foreignKey({ name: 'user_roles_role_fk', columns: [table.tenantId, table.roleId], foreignColumns: [roles.tenantId, roles.id] }).onDelete('cascade'),
  tenantIsolationPolicy('user_roles'),
]);
