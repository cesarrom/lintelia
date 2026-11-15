import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysWorkflows } from './workflow.entity'; // Import for FK relationship
import { TriggerAction, TriggerPattern } from '../../schemas/shared.schema';

export const sysSystemTriggers = pgTable('sys_system_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'), // Nullable
  isActive: boolean('is_active').default(true).notNull(),
  pattern: jsonb('pattern').$type<TriggerPattern>().notNull(),
  action: jsonb('action').$type<TriggerAction>().notNull(),
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust if needed
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => sysWorkflows.id, { onDelete: 'cascade' }), // Define FK, assuming cascade delete
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Define relationships
export const sysSystemTriggerRelations = relations(sysSystemTriggers, ({ one }) => ({
  workflow: one(sysWorkflows, {
    fields: [sysSystemTriggers.workflowId],
    references: [sysWorkflows.id],
  }),
}));