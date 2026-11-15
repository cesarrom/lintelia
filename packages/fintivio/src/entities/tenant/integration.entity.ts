import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, jsonb, timestamp, index, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';
import { cases } from './case.entity';

export type InstallationStatus = 'pending' | 'active' | 'failing' | 'disabled';

/** A connector installed by the institution (or by one of its clients): "a connection" (docs/plans/03). */
export const connectorInstallations = pgTable('connector_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  connectorId: varchar('connector_id', { length: 64 }).notNull(),
  connectorVersion: varchar('connector_version', { length: 32 }).notNull(),
  audience: varchar('audience', { length: 16 }).$type<'tenant' | 'client'>().default('tenant').notNull(),
  ownerId: uuid('owner_id'),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 16 }).$type<InstallationStatus>().default('pending').notNull(),
  grantedScopes: text('granted_scopes').array().default(sql`'{}'::text[]`).notNull(),
  /** Non-secret configuration the connector publishes (shown in the UI). Secrets stay in the connector. */
  configSummary: jsonb('config_summary').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  lastError: text('last_error'),
  createdByEmail: varchar('created_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('connector_installations', table),
  index('connector_installations_connector_idx').on(table.tenantId, table.connectorId),
]);

/**
 * Canonical records attached to cases (verification results, signature requests, messages, screening results),
 * written by connectors through the connector API; rendered generically by the back office.
 */
export const caseRecords = pgTable('case_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id'),
  partyId: uuid('party_id'),
  type: varchar('type', { length: 32 }).notNull(),
  installationId: uuid('installation_id').notNull(),
  connectorId: varchar('connector_id', { length: 64 }).notNull(),
  externalRef: varchar('external_ref', { length: 255 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  summary: text('summary'),
  data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  history: jsonb('history').$type<Array<{ at: string; status: string }>>().default(sql`'[]'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('case_records', table),
  uniqueIndex('case_records_ref_idx').on(table.tenantId, table.installationId, table.type, table.externalRef),
  index('case_records_case_idx').on(table.tenantId, table.caseId),
  foreignKey({ name: 'case_records_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
  foreignKey({ name: 'case_records_installation_fk', columns: [table.tenantId, table.installationId], foreignColumns: [connectorInstallations.tenantId, connectorInstallations.id] }).onDelete('cascade'),
]);
