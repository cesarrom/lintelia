import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, integer, index, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

/** A secret of an API client: only its SHA-256 hash is stored; up to two are valid during a rotation. */
export interface ApiClientSecret {
  id: string;
  hash: string;
  /** First characters, to tell secrets apart in the UI. */
  prefix: string;
  createdAt: string;
  /** The previous secret keeps working until this instant after a rotation. */
  expiresAt: string | null;
}

/**
 * Machine access for the institution's own systems (docs/plans/04): OAuth 2.0 client credentials. Permissions are a
 * subset of the creator's; tokens are short-lived JWTs; revocation is immediate.
 */
export const apiClients = pgTable('api_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: varchar('name', { length: 255 }).notNull(),
  clientId: varchar('client_id', { length: 64 }).notNull(),
  secrets: jsonb('secrets').$type<ApiClientSecret[]>().default(sql`'[]'::jsonb`).notNull(),
  permissions: text('permissions').array().default(sql`'{}'::text[]`).notNull(),
  status: varchar('status', { length: 16 }).$type<'active' | 'revoked'>().default('active').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
  createdByEmail: varchar('created_by_email', { length: 320 }),
  lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }),
  revokedAt: timestamp('revoked_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('api_clients', table),
  uniqueIndex('api_clients_client_id_idx').on(table.clientId),
]);

/**
 * Events waiting to be delivered to webhook subscriptions, written together with the audit entry that records the
 * change (one transaction), then dispatched by the Restate webhook dispatcher.
 */
export const eventOutbox = pgTable('event_outbox', {
  id: varchar('id', { length: 40 }).primaryKey(),
  tenantId: tenantIdColumn(),
  type: varchar('type', { length: 64 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  dispatchedAt: timestamp('dispatched_at', { mode: 'date', withTimezone: true }),
}, (table) => [
  ...tenantTable('event_outbox', table),
  index('event_outbox_pending_idx').on(table.tenantId, table.dispatchedAt),
]);

/** Where the institution wants to be told about events (Standard Webhooks format, `whsec_` secrets). */
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  url: text('url').notNull(),
  description: text('description'),
  eventTypes: text('event_types').array().default(sql`'{}'::text[]`).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  /** Signing secret, encrypted with the data encryption key (it must be available to sign). */
  secretCiphertext: text('secret_ciphertext').notNull(),
  /** During a rotation the previous secret signs too, until it expires. */
  previousSecretCiphertext: text('previous_secret_ciphertext'),
  previousSecretExpiresAt: timestamp('previous_secret_expires_at', { mode: 'date', withTimezone: true }),
  failingSince: timestamp('failing_since', { mode: 'date', withTimezone: true }),
  disabledReason: text('disabled_reason'),
  createdByEmail: varchar('created_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('webhook_subscriptions', table),
]);

export interface WebhookAttempt {
  at: string;
  statusCode: number | null;
  error: string | null;
  latencyMs: number;
}

/** One event for one subscription: its attempts and outcome (the delivery log). */
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  subscriptionId: uuid('subscription_id').notNull(),
  eventId: varchar('event_id', { length: 40 }).notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).$type<'pending' | 'retrying' | 'delivered' | 'failed'>().default('pending').notNull(),
  attempts: jsonb('attempts').$type<WebhookAttempt[]>().default(sql`'[]'::jsonb`).notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastStatusCode: integer('last_status_code'),
  responseExcerpt: text('response_excerpt'),
  nextAttemptAt: timestamp('next_attempt_at', { mode: 'date', withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('webhook_deliveries', table),
  uniqueIndex('webhook_deliveries_event_idx').on(table.tenantId, table.subscriptionId, table.eventId),
  index('webhook_deliveries_subscription_idx').on(table.tenantId, table.subscriptionId, table.createdAt),
  foreignKey({ name: 'webhook_deliveries_subscription_fk', columns: [table.tenantId, table.subscriptionId], foreignColumns: [webhookSubscriptions.tenantId, webhookSubscriptions.id] }).onDelete('cascade'),
]);
