import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, bigint, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';
import { users } from './user.entity';

/** Hashed single-use recovery codes of a second factor. */
export interface RecoveryCode {
  hash: string;
  usedAt: string | null;
}

/**
 * Second factors of institution members (docs/plans/02 §Our own MFA): TOTP (RFC 6238) for now, passkeys next. The
 * secret is encrypted with the data encryption key; `lastUsedStep` rejects a code used twice (RFC 6238 §5.2).
 */
export const mfaFactors = pgTable('mfa_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 16 }).$type<'totp'>().notNull(),
  secretCiphertext: text('secret_ciphertext').notNull(),
  recoveryCodes: jsonb('recovery_codes').$type<RecoveryCode[]>().default(sql`'[]'::jsonb`).notNull(),
  lastUsedStep: bigint('last_used_step', { mode: 'number' }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('mfa_factors', table),
  uniqueIndex('mfa_factors_user_type_idx').on(table.tenantId, table.userId, table.type),
  foreignKey({ name: 'mfa_factors_user_fk', columns: [table.tenantId, table.userId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);

/** The institution's security policy (FIA-08): second factor for password sign-ins; SSO enforcement lives with SSO. */
export const tenantSecurityPolicies = pgTable('tenant_security_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  requireMfa: boolean('require_mfa').default(true).notNull(),
  /** Access changes that grant something wait for a second administrator (`grants`) or apply at once (`off`). */
  accessApproval: varchar('access_approval', { length: 16 }).$type<'off' | 'grants'>().default('off').notNull(),
  /** Extra addresses told about privileged access changes (e.g. the security team's mailbox). */
  accessNotify: text('access_notify').array().default(sql`'{}'::text[]`).notNull(),
  /** Record who opened which client through the back office's custom pages (`client.viewed`, docs/plans/16 §5.5). */
  readAudit: boolean('read_audit').default(false).notNull(),
  updatedByEmail: varchar('updated_by_email', { length: 320 }),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('tenant_security_policies', table),
  uniqueIndex('tenant_security_policies_tenant_idx').on(table.tenantId),
]);

/**
 * Single sign-on of the institution through the SSO broker (WorkOS, docs/plans/02): its organization there, the
 * domains verified there (cached), enforcement and just-in-time provisioning.
 */
export const tenantSsoSettings = pgTable('tenant_sso_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  organizationId: varchar('organization_id', { length: 64 }),
  enforce: boolean('enforce').default(false).notNull(),
  jitEnabled: boolean('jit_enabled').default(false).notNull(),
  jitDefaultRoles: text('jit_default_roles').array().default(sql`'{}'::text[]`).notNull(),
  verifiedDomains: text('verified_domains').array().default(sql`'{}'::text[]`).notNull(),
  /** Directory sync: the last broker event applied (members provisioned/deprovisioned by the IdP). */
  eventsCursor: varchar('events_cursor', { length: 128 }),
  updatedByEmail: varchar('updated_by_email', { length: 320 }),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('tenant_sso_settings', table),
  uniqueIndex('tenant_sso_settings_tenant_idx').on(table.tenantId),
]);

/** Members linked to their identity at the institution's IdP (through the broker's profile id). */
export const ssoIdentities = pgTable('sso_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  userId: uuid('user_id').notNull(),
  provider: varchar('provider', { length: 32 }).default('workos').notNull(),
  profileId: varchar('profile_id', { length: 128 }).notNull(),
  connectionId: varchar('connection_id', { length: 128 }),
  idpId: varchar('idp_id', { length: 255 }),
  lastLoginAt: timestamp('last_login_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('sso_identities', table),
  uniqueIndex('sso_identities_profile_idx').on(table.tenantId, table.provider, table.profileId),
  foreignKey({ name: 'sso_identities_user_fk', columns: [table.tenantId, table.userId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);
