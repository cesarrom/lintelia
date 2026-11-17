import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';
import { users } from './user.entity';

/**
 * The client app of an institution (docs/plans/11): pages, journeys, collections, profile, sign-up and identity
 * settings. `draft` is edited freely; publishing freezes it as the next immutable version (like workflows).
 */
export const clientApps = pgTable('client_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  key: varchar('key', { length: 64 }).default('default').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  draft: jsonb('draft').$type<Record<string, unknown>>().notNull(),
  activeVersion: integer('active_version'),
  updatedBy: varchar('updated_by', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('client_apps', table),
  uniqueIndex('client_apps_key_idx').on(table.tenantId, table.key),
]);

export const clientAppVersions = pgTable('client_app_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  appId: uuid('app_id').notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
  publishedBy: varchar('published_by', { length: 320 }),
  publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('client_app_versions', table),
  uniqueIndex('client_app_versions_idx').on(table.tenantId, table.appId, table.version),
  foreignKey({ name: 'client_app_versions_app_fk', columns: [table.tenantId, table.appId], foreignColumns: [clientApps.tenantId, clientApps.id] }).onDelete('cascade'),
]);

/**
 * What the institution knows about a client beyond the account: its own customer id (`externalId` from the source that
 * identified the client: `api`, or the issuer of an exchanged token), typed attributes (KYC level, customer number…),
 * segments (drive navigation and eligibility) and consents.
 */
export const clientProfiles = pgTable('client_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  userId: uuid('user_id').notNull(),
  externalSource: varchar('external_source', { length: 255 }),
  externalId: varchar('external_id', { length: 255 }),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  segments: text('segments').array().default(sql`'{}'::text[]`).notNull(),
  consents: jsonb('consents').$type<Array<{ key: string; version: string; acceptedAt: string }>>().default(sql`'[]'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('client_profiles', table),
  uniqueIndex('client_profiles_user_idx').on(table.tenantId, table.userId),
  uniqueIndex('client_profiles_external_idx').on(table.tenantId, table.externalSource, table.externalId),
  foreignKey({ name: 'client_profiles_user_fk', columns: [table.tenantId, table.userId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);

/**
 * Data a client sees in their app, by collection (accounts, transactions, cards, budgets…): pushed by the
 * institution's systems (API), written by workflows (`client.record`) or by connectors. Keyed per client.
 */
export const clientRecords = pgTable('client_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  clientId: uuid('client_id').notNull(),
  collection: varchar('collection', { length: 64 }).notNull(),
  key: varchar('key', { length: 128 }).notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  /** `api`, `workflow:<case reference>`, `connector:<id>`, `seed`. */
  source: varchar('source', { length: 128 }).default('api').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('client_records', table),
  uniqueIndex('client_records_key_idx').on(table.tenantId, table.clientId, table.collection, table.key),
  index('client_records_collection_idx').on(table.tenantId, table.clientId, table.collection),
  foreignKey({ name: 'client_records_client_fk', columns: [table.tenantId, table.clientId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);

/** In-app notifications of a client (also sent by e-mail when the workflow asks for it). */
export const clientNotifications = pgTable('client_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  clientId: uuid('client_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  tone: varchar('tone', { length: 16 }).default('info').notNull(),
  /** Page (and parameters) or journey the notification opens. */
  link: jsonb('link').$type<{ page?: string; params?: Record<string, string>; caseId?: string } | null>(),
  readAt: timestamp('read_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('client_notifications', table),
  index('client_notifications_client_idx').on(table.tenantId, table.clientId, table.createdAt),
  foreignKey({ name: 'client_notifications_client_fk', columns: [table.tenantId, table.clientId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);
