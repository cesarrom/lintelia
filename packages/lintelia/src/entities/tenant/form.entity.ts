import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, json, jsonb } from 'drizzle-orm/pg-core';
import { type FormConfig } from '../../schemas/forms.schema.js';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysForms = pgTable('sys_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  config: json('config').$type<FormConfig>().notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  variables: jsonb('variables').$type<Record<string, string>>(),
  /** Set while the form is published for embedding (see public_form_keys). */
  publicKey: varchar('public_key', { length: 64 }),
  publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
  allowedOrigins: text('allowed_origins').array().default(sql`'{}'::text[]`).notNull(),
  /** Workflow started by each verified submission. */
  workflowId: uuid('workflow_id'),
}, (table) => tenantTable('sys_forms', table));
