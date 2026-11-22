import { pgTable, uuid, varchar, timestamp, pgEnum, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysWorkflows } from './workflow.entity';
import { workflowExecutionStatusSchema } from '../../schemas/shared.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const workflowExecutionStatusEnum = pgEnum('workflow_execution_status', workflowExecutionStatusSchema.options);

export const sysWorkflowExecutions = pgTable('sys_workflow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  workflowId: uuid('workflow_id').notNull(),
  status: workflowExecutionStatusEnum('status').default('pending').notNull(),
  startedAt: timestamp('started_at', { mode: 'date', withTimezone: true }),
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  executionNodeId: varchar('execution_node_id'),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_workflow_executions', table),
  foreignKey({ name: 'sys_workflow_executions_workflow_fk', columns: [table.tenantId, table.workflowId], foreignColumns: [sysWorkflows.tenantId, sysWorkflows.id] }).onDelete('cascade'),
]);

export const sysWorkflowExecutionRelations = relations(sysWorkflowExecutions, ({ one }) => ({
  workflow: one(sysWorkflows, {
    fields: [sysWorkflowExecutions.workflowId],
    references: [sysWorkflows.id],
  }),
}));
