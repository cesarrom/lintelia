import { pgTable, uuid, varchar, text, timestamp, pgEnum, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysWorkflows } from './workflow.entity';
import { workflowTriggerStatusSchema } from '../../schemas/shared.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const workflowTriggerStatusEnum = pgEnum('workflow_trigger_status', workflowTriggerStatusSchema.options);

export const sysWorkflowTriggers = pgTable('sys_workflow_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  workflowId: uuid('workflow_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type').notNull(),
  eventName: varchar('event_name').notNull(),
  config: text('config').notNull(),
  status: workflowTriggerStatusEnum('status').default('active').notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_workflow_triggers', table),
  foreignKey({ name: 'sys_workflow_triggers_workflow_fk', columns: [table.tenantId, table.workflowId], foreignColumns: [sysWorkflows.tenantId, sysWorkflows.id] }).onDelete('cascade'),
]);

export const sysWorkflowTriggerRelations = relations(sysWorkflowTriggers, ({ one }) => ({
  workflow: one(sysWorkflows, {
    fields: [sysWorkflowTriggers.workflowId],
    references: [sysWorkflows.id],
  }),
}));
