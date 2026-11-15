import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { type WorkflowValue } from '../../schemas/workflows.schema';
import { sysDocumentTemplates } from './document-template.entity';

export const sysDocuments = pgTable('sys_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignee: varchar('assignee', { length: 255 }).notNull(),
  targetUsers: jsonb('target_users').$type<string[]>().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  documentTemplateId: uuid('document_template_id').notNull().references(() => sysDocumentTemplates.id),
  values: jsonb('values').$type<Record<string, WorkflowValue>>().notNull(),
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});