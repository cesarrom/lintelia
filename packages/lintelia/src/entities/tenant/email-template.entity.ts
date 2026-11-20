import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { type WorkflowValue } from '../../schemas/workflows.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysEmailTemplates = pgTable('sys_email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  variables: jsonb('variables').$type<Record<string, WorkflowValue>>().notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => tenantTable('sys_email_templates', table));
