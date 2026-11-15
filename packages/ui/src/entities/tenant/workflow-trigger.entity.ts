import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysWorkflows } from './workflow.entity'; // Import the Drizzle table
import { workflowTriggerStatusSchema } from '../../schemas/shared.schema';

// Define ENUM values for Drizzle
export const workflowTriggerStatusEnum = pgEnum('workflow_trigger_status', workflowTriggerStatusSchema.options);

export const sysWorkflowTriggers = pgTable('sys_workflow_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => sysWorkflows.id, { onDelete: 'cascade' }), // Define FK relationship, assuming cascade delete
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'), // Nullable
  type: varchar('type').notNull(), // Assuming varchar, adjust length if needed
  eventName: varchar('event_name').notNull(), // Matches field name, assuming varchar
  config: text('config').notNull(), // Mapped from TEXT
  status: workflowTriggerStatusEnum('status').default('active').notNull(),
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Define relationships
export const sysWorkflowTriggerRelations = relations(sysWorkflowTriggers, ({ one }) => ({
  workflow: one(sysWorkflows, {
    fields: [sysWorkflowTriggers.workflowId],
    references: [sysWorkflows.id],
  }),
}));