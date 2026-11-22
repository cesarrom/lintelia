import { sql } from 'drizzle-orm';
import { pgTable, varchar, timestamp, uuid, pgPolicy, jsonb, integer, bigint, index, uniqueIndex, text, foreignKey } from 'drizzle-orm/pg-core';
import { platformRole } from '../rls';
import { tenants } from './tenant.entity';
import { platformUsers } from './platform-user.entity';

/**
 * Platform audit trail: what staff did (onboarding, suspending, deleting institutions, staff changes, support-access
 * requests). Append-only for `lintelia_platform` (INSERT/SELECT grants only) and hash-chained like the tenant audit
 * trail. `tenant_id` has no foreign key so entries survive the institution they are about.
 */
export const platformAuditEvents = pgTable('platform_audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  seq: bigint('seq', { mode: 'number' }).notNull(),
  at: timestamp('at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  actorType: varchar('actor_type', { length: 16 }).notNull(),
  actorId: varchar('actor_id', { length: 64 }),
  actorEmail: varchar('actor_email', { length: 320 }),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }),
  targetId: varchar('target_id', { length: 64 }),
  tenantId: uuid('tenant_id'),
  tenantKey: varchar('tenant_key', { length: 255 }),
  details: jsonb('details').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  previousHash: varchar('previous_hash', { length: 64 }),
  hash: varchar('hash', { length: 64 }).notNull(),
}, (table) => [
  uniqueIndex('platform_audit_events_seq_idx').on(table.seq),
  index('platform_audit_events_tenant_idx').on(table.tenantKey),
  pgPolicy('platform_audit_events_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

export type SupportGrantStatus = 'pending' | 'active' | 'denied' | 'revoked' | 'expired';

/**
 * Time-bound, institution-approved support access (Customer Lockbox style): a staff member asks for read-only access
 * to one institution for a reason and a duration; a member with `support_access:approve` approves or denies it; the
 * grant can be revoked and expires on its own.
 */
export const supportGrants = pgTable('support_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  staffId: uuid('staff_id').notNull(),
  staffEmail: varchar('staff_email', { length: 320 }).notNull(),
  reason: text('reason').notNull(),
  scope: varchar('scope', { length: 16 }).$type<'read'>().default('read').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  status: varchar('status', { length: 16 }).$type<SupportGrantStatus>().default('pending').notNull(),
  requestedAt: timestamp('requested_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
  decidedByEmail: varchar('decided_by_email', { length: 320 }),
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
  revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
}, (table) => [
  index('support_grants_tenant_idx').on(table.tenantId, table.status),
  foreignKey({ name: 'support_grants_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ name: 'support_grants_staff_fk', columns: [table.staffId], foreignColumns: [platformUsers.id] }).onDelete('cascade'),
  pgPolicy('support_grants_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/** Connectors known to the platform (docs/plans/03). First-party only for now. */
export const connectors = pgTable('connectors', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 16 }).$type<'active' | 'revoked'>().default('active').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, () => [
  pgPolicy('connectors_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/** Versions of each connector's manifest; only `approved` versions can be installed and executed. */
export const connectorVersions = pgTable('connector_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectorId: varchar('connector_id', { length: 64 }).notNull(),
  version: varchar('version', { length: 32 }).notNull(),
  manifest: jsonb('manifest').$type<Record<string, unknown>>().notNull(),
  manifestHash: varchar('manifest_hash', { length: 64 }).notNull(),
  manifestUrl: text('manifest_url').notNull(),
  status: varchar('status', { length: 16 }).$type<'draft' | 'approved' | 'deprecated' | 'revoked'>().default('draft').notNull(),
  approvedBy: varchar('approved_by', { length: 320 }),
  approvedAt: timestamp('approved_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('connector_versions_version_idx').on(table.connectorId, table.version),
  foreignKey({ name: 'connector_versions_connector_fk', columns: [table.connectorId], foreignColumns: [connectors.id] }).onDelete('cascade'),
  pgPolicy('connector_versions_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/**
 * Lookup from installation id to its tenant (the connector API resolves the tenant before any tenant context exists).
 * The installation itself lives in the tenant's `connector_installations`.
 */
export const connectorInstallationIndex = pgTable('connector_installation_index', {
  installationId: uuid('installation_id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  connectorId: varchar('connector_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'connector_installation_index_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  pgPolicy('connector_installation_index_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/**
 * Lookup from an API client id to its tenant: the OAuth token endpoint authenticates a client before any tenant
 * context exists. The client itself (secret hashes, permissions) lives in the tenant's `api_clients`.
 */
export const apiClientIndex = pgTable('api_client_index', {
  clientId: varchar('client_id', { length: 64 }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'api_client_index_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  pgPolicy('api_client_index_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/** Second factors of platform staff (always required for staff password sign-ins). */
export const platformMfaFactors = pgTable('platform_mfa_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  staffId: uuid('staff_id').notNull(),
  type: varchar('type', { length: 16 }).$type<'totp'>().notNull(),
  secretCiphertext: text('secret_ciphertext').notNull(),
  recoveryCodes: jsonb('recovery_codes').$type<Array<{ hash: string; usedAt: string | null }>>().default(sql`'[]'::jsonb`).notNull(),
  lastUsedStep: bigint('last_used_step', { mode: 'number' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('platform_mfa_factors_staff_type_idx').on(table.staffId, table.type),
  foreignKey({ name: 'platform_mfa_factors_staff_fk', columns: [table.staffId], foreignColumns: [platformUsers.id] }).onDelete('cascade'),
  pgPolicy('platform_mfa_factors_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

export type CustomDomainStatus = 'pending_verification' | 'active' | 'failed';

/**
 * Custom host names of institutions (docs/plans/09): ownership proven with a DNS TXT record before the host serves the
 * institution (it is then added to the tenant's `allowed_domains`). Platform table: a host name is unique across all
 * institutions (no takeover); institutions manage theirs through the API.
 */
export const customDomains = pgTable('custom_domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  hostname: varchar('hostname', { length: 253 }).notNull(),
  status: varchar('status', { length: 32 }).$type<CustomDomainStatus>().default('pending_verification').notNull(),
  verificationToken: varchar('verification_token', { length: 64 }).notNull(),
  failureReason: text('failure_reason'),
  lastCheckedAt: timestamp('last_checked_at', { mode: 'date', withTimezone: true }),
  verifiedAt: timestamp('verified_at', { mode: 'date', withTimezone: true }),
  createdByEmail: varchar('created_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('custom_domains_hostname_idx').on(table.hostname),
  foreignKey({ name: 'custom_domains_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  pgPolicy('custom_domains_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/** Platform-wide settings (e.g. single sign-on of the staff through the company IdP). One row per key. */
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedByEmail: varchar('updated_by_email', { length: 320 }),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, () => [
  pgPolicy('platform_settings_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);

/** Which institution a broker organization belongs to (directory sync runs without a tenant context). */
export const ssoOrganizationIndex = pgTable('sso_organization_index', {
  organizationId: varchar('organization_id', { length: 64 }).primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: 'sso_organization_index_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  pgPolicy('sso_organization_index_platform_all', { as: 'permissive', for: 'all', to: platformRole, using: sql`true`, withCheck: sql`true` }),
]);
