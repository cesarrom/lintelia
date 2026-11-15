import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { type WorkflowValue } from '../../schemas/workflows.schema';

export const sysEmailTemplates = pgTable('sys_email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'), // Nullable by default
  subject: text('subject').notNull(), // Using text for consistency with body
  body: text('body').notNull(),
  variables: jsonb('variables').$type<Record<string, WorkflowValue>>().notNull(),
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});