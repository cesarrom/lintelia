import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, timestamp, pgEnum, uniqueIndex, text, primaryKey, foreignKey, boolean, jsonb, index } from 'drizzle-orm/pg-core';
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
  /**
   * Groups the institution's identity provider says the member belongs to (docs/plans/15 §5.4): from the last SSO
   * sign-in (`sso`) and from directory sync (`scim`). Roles are derived from them when roles come from the IdP.
   */
  idpGroups: jsonb('idp_groups').$type<{ sso?: string[]; scim?: string[]; updatedAt?: string }>().default({}).notNull(),
  /** Member attributes (branch, region, licences…) declared by the institution (docs/plans/15 §5.5). */
  attributes: jsonb('attributes').$type<Record<string, unknown>>().default({}).notNull(),
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
  /** System roles come from the catalogue (packages/lintelia authorization.schema.ts) and cannot be edited. */
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('roles', table),
  uniqueIndex('roles_tenant_key_idx').on(table.tenantId, table.key),
]);

/** How a member got a role: by hand, from the identity provider's groups, or the default of just-in-time accounts. */
export type RoleAssignmentSource = 'manual' | 'idp' | 'default' | 'recovery';

export const userRoles = pgTable('user_roles', {
  tenantId: tenantIdColumn(),
  userId: uuid('user_id').notNull(),
  roleId: uuid('role_id').notNull(),
  source: varchar('source', { length: 16 }).$type<RoleAssignmentSource>().default('manual').notNull(),
  /** The IdP groups that gave the role (source `idp`). */
  groups: text('groups').array().default(sql`'{}'::text[]`).notNull(),
  /** Time-bound assignments end here (ignored afterwards, removed by the daily job). */
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
  grantedByEmail: varchar('granted_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ name: 'user_roles_pk', columns: [table.tenantId, table.userId, table.roleId] }),
  foreignKey({ name: 'user_roles_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ name: 'user_roles_user_fk', columns: [table.tenantId, table.userId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
  foreignKey({ name: 'user_roles_role_fk', columns: [table.tenantId, table.roleId], foreignColumns: [roles.tenantId, roles.id] }).onDelete('cascade'),
  tenantIsolationPolicy('user_roles'),
]);

/**
 * Custom permissions (docs/plans/15 §5.1): capabilities an institution names itself (`custom:fees.waive`), granted
 * through roles like built-in permissions. Archived rather than deleted, so audit entries keep their meaning.
 */
export const customPermissions = pgTable('custom_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  key: varchar('key', { length: 80 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 1024 }).default('').notNull(),
  category: varchar('category', { length: 80 }).default('Custom').notNull(),
  archivedAt: timestamp('archived_at', { mode: 'date', withTimezone: true }),
  createdByEmail: varchar('created_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('custom_permissions', table),
  uniqueIndex('custom_permissions_tenant_key_idx').on(table.tenantId, table.key),
]);

/** IdP group → role (docs/plans/15 §5.4). Groups are matched by name, case-insensitively (SSO claims and SCIM groups). */
export const roleMappings = pgTable('role_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  groupName: varchar('group_name', { length: 255 }).notNull(),
  roleId: uuid('role_id').notNull(),
  createdByEmail: varchar('created_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('role_mappings', table),
  uniqueIndex('role_mappings_group_role_idx').on(table.tenantId, sql`lower(${table.groupName})`, table.roleId),
  foreignKey({ name: 'role_mappings_role_fk', columns: [table.tenantId, table.roleId], foreignColumns: [roles.tenantId, roles.id] }).onDelete('cascade'),
]);

/** Member attributes the institution declares (docs/plans/15 §5.5) and where their values come from. */
export const memberAttributeDefinitions = pgTable('member_attribute_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  key: varchar('key', { length: 48 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  /** text | number | select | list */
  type: varchar('type', { length: 16 }).default('text').notNull(),
  options: text('options').array().default(sql`'{}'::text[]`).notNull(),
  /** `manual` (set in the Team page) or `idp` (SSO claims / directory attributes; read-only in the app). */
  source: varchar('source', { length: 16 }).default('manual').notNull(),
  /** JSONata over the SSO profile's raw attributes (source idp), e.g. `department`. */
  ssoClaim: varchar('sso_claim', { length: 512 }),
  /** JSONata over the directory user's raw SCIM attributes (source idp), e.g. `"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User".department`. */
  scimAttribute: varchar('scim_attribute', { length: 512 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('member_attribute_definitions', table),
  uniqueIndex('member_attribute_definitions_key_idx').on(table.tenantId, table.key),
]);

export type AccessChangeStatus = 'pending_approval' | 'scheduled' | 'applied' | 'rejected' | 'cancelled' | 'expired' | 'failed';

/**
 * Privileged access changes (docs/plans/15 §14): role definitions, role assignments, IdP mappings, workflow access.
 * Kept whether applied at once or not: the log of who asked, who approved, when it took effect.
 */
export const accessChanges = pgTable('access_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  kind: varchar('kind', { length: 48 }).notNull(),
  summary: text('summary').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  /** What changes, for people: `{ before, after }` or a list of lines. */
  diff: jsonb('diff').$type<Record<string, unknown>>().default({}).notNull(),
  /** Grants something (adds permissions, assigns roles, widens access): the kind of change approval applies to. */
  grants: boolean('grants').default(false).notNull(),
  status: varchar('status', { length: 24 }).$type<AccessChangeStatus>().notNull(),
  requestedById: uuid('requested_by_id'),
  requestedByEmail: varchar('requested_by_email', { length: 320 }),
  requestedByType: varchar('requested_by_type', { length: 16 }).default('member').notNull(),
  effectiveAt: timestamp('effective_at', { mode: 'date', withTimezone: true }),
  approvedById: uuid('approved_by_id'),
  approvedByEmail: varchar('approved_by_email', { length: 320 }),
  decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
  decisionReason: text('decision_reason'),
  appliedAt: timestamp('applied_at', { mode: 'date', withTimezone: true }),
  error: text('error'),
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('access_changes', table),
  index('access_changes_status_idx').on(table.tenantId, table.status),
]);
