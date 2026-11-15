import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysWorkflows } from './workflow.entity'; // Import the Drizzle table
import { workflowExecutionStatusSchema } from '../../schemas/shared.schema';

// Define ENUM values for Drizzle
export const workflowExecutionStatusEnum = pgEnum('workflow_execution_status', workflowExecutionStatusSchema.options);

export const sysWorkflowExecutions = pgTable('sys_workflow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => sysWorkflows.id, { onDelete: 'cascade' }), // Define FK relationship
  status: workflowExecutionStatusEnum('status').default('pending').notNull(),
  startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }), // Nullable by default
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }), // Nullable by default
  executionNodeId: varchar('execution_node_id'), // Nullable by default, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Define relationships
export const sysWorkflowExecutionRelations = relations(sysWorkflowExecutions, ({ one }) => ({
  workflow: one(sysWorkflows, {
    fields: [sysWorkflowExecutions.workflowId],
    references: [sysWorkflows.id],
  }),
}));