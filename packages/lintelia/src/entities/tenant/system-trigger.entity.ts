import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysWorkflows } from './workflow.entity';
import { TriggerAction, TriggerPattern } from '../../schemas/shared.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysSystemTriggers = pgTable('sys_system_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  pattern: jsonb('pattern').$type<TriggerPattern>().notNull(),
  action: jsonb('action').$type<TriggerAction>().notNull(),
  createdBy: varchar('created_by').notNull(),
  workflowId: uuid('workflow_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_system_triggers', table),
  foreignKey({ name: 'sys_system_triggers_workflow_fk', columns: [table.tenantId, table.workflowId], foreignColumns: [sysWorkflows.tenantId, sysWorkflows.id] }).onDelete('cascade'),
]);

export const sysSystemTriggerRelations = relations(sysSystemTriggers, ({ one }) => ({
  workflow: one(sysWorkflows, {
    fields: [sysSystemTriggers.workflowId],
    references: [sysWorkflows.id],
  }),
}));
