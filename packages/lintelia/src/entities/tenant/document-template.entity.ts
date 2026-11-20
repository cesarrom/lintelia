import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { type WorkflowValue } from '../../schemas/workflows.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysDocumentTemplates = pgTable('sys_document_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  documentUrl: text('document_url').notNull(),
  variables: jsonb('variables').$type<Record<string, WorkflowValue>>().notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => tenantTable('sys_document_templates', table));
