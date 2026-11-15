import { pgTable, uuid, varchar, jsonb, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { type WorkflowValue } from '../../schemas/workflows.schema';
import { sysDocumentTemplates } from './document-template.entity';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysDocuments = pgTable('sys_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  assignee: varchar('assignee', { length: 255 }).notNull(),
  targetUsers: jsonb('target_users').$type<string[]>().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  documentTemplateId: uuid('document_template_id').notNull(),
  values: jsonb('values').$type<Record<string, WorkflowValue>>().notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_documents', table),
  foreignKey({ name: 'sys_documents_template_fk', columns: [table.tenantId, table.documentTemplateId], foreignColumns: [sysDocumentTemplates.tenantId, sysDocumentTemplates.id] }),
]);
