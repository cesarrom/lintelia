import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, jsonb, timestamp, boolean, bigserial, index, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';
import { cases } from './case.entity';

/**
 * Events from outside reaching running workflows (docs/plans/17 §3): every event the institution receives — from its
 * systems (`api:<type>`), connectors (`connector:<id>/<type>`) or the platform (`client.flagged`…) — is kept for a
 * while (so a case that starts waiting just after it arrived can still get it) and routed: delivered to the cases
 * waiting for it (by correlation key), to the open case of a workflow that starts-or-receives it, or starting cases.
 */
export const inboundEvents = pgTable('inbound_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  type: varchar('type', { length: 160 }).notNull(),
  /** Who sent it: `api:<client id>`, `connector:<id>`, `platform`. */
  source: varchar('source', { length: 255 }).notNull(),
  /** The sender's id of the event, deduplicated per sender (`api:<id>`, `connector:<installation>:<id>`). */
  dedupeKey: varchar('dedupe_key', { length: 320 }),
  data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  applicant: jsonb('applicant').$type<{ id?: string | null; email?: string | null; name?: string | null } | null>(),
  /** Cases it was handed to and cases it started (for the sender and the audit). */
  deliveredTo: jsonb('delivered_to').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  startedCases: jsonb('started_cases').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  /** A waiting step with `consume: true` took it: nobody else gets it. */
  consumedBy: uuid('consumed_by'),
  receivedAt: timestamp('received_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('inbound_events', table),
  uniqueIndex('inbound_events_dedupe_idx').on(table.tenantId, table.dedupeKey),
  index('inbound_events_type_idx').on(table.tenantId, table.type, table.receivedAt),
]);

/**
 * Business keys of open cases (`correlation:` in the workflow, `keys:` of `case.update`): a loan id, a card, a client.
 * Events name what they are about with the same values; removed when the case ends.
 */
export const caseKeys = pgTable('case_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('case_keys', table),
  uniqueIndex('case_keys_case_name_idx').on(table.tenantId, table.caseId, table.name),
  index('case_keys_value_idx').on(table.tenantId, table.name, table.value),
  foreignKey({ name: 'case_keys_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
]);

/**
 * An `event.wait` step waiting: the event type, what the event must say about the case (its keys' values when the
 * step started), a filter, and the durable promise to resolve.
 */
export const caseEventWaits = pgTable('case_event_waits', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id').notNull(),
  stepId: varchar('step_id', { length: 128 }).notNull(),
  promise: varchar('promise', { length: 160 }).notNull(),
  eventType: varchar('event_type', { length: 160 }).notNull(),
  /** Case key → `{ expression over the event, value the case holds }`. */
  match: jsonb('match').$type<Record<string, { expression: string; value: string }>>().default(sql`'{}'::jsonb`).notNull(),
  filter: text('filter'),
  consume: boolean('consume').default(false).notNull(),
  status: varchar('status', { length: 16 }).$type<'waiting' | 'delivered' | 'cancelled'>().notNull(),
  eventId: uuid('event_id'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at', { mode: 'date', withTimezone: true }),
}, (table) => [
  ...tenantTable('case_event_waits', table),
  uniqueIndex('case_event_waits_promise_idx').on(table.tenantId, table.caseId, table.promise),
  index('case_event_waits_type_idx').on(table.tenantId, table.eventType, table.status),
  foreignKey({ name: 'case_event_waits_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
]);

/**
 * Events handed to one case: delivered to a waiting step, or kept for the case until one of its steps waits for that
 * type (start-or-deliver). Unique per case and event: a case never gets an event twice.
 */
export const caseEvents = pgTable('case_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id').notNull(),
  eventId: uuid('event_id').notNull(),
  eventType: varchar('event_type', { length: 160 }).notNull(),
  status: varchar('status', { length: 16 }).$type<'pending' | 'delivered'>().notNull(),
  waitId: uuid('wait_id'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at', { mode: 'date', withTimezone: true }),
}, (table) => [
  ...tenantTable('case_events', table),
  uniqueIndex('case_events_once_idx').on(table.tenantId, table.caseId, table.eventId),
  index('case_events_pending_idx').on(table.tenantId, table.caseId, table.eventType, table.status),
  foreignKey({ name: 'case_events_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
]);

/**
 * Messages of live channels (docs/plans/17 §4): what workflows publish (`live.publish`) on a case's channel, to a client,
 * a member or a role — ordered (`seq`), kept a few days so a screen that starts listening late gets them (replay).
 */
export const liveMessages = pgTable('live_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  seq: bigserial('seq', { mode: 'number' }).notNull(),
  topic: varchar('topic', { length: 255 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('live_messages', table),
  index('live_messages_topic_idx').on(table.tenantId, table.topic, table.seq),
]);
