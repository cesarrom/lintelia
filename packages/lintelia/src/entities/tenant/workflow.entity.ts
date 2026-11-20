import { pgTable, uuid, varchar, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { workflowStatusSchema } from '../../schemas/shared.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const workflowStatusEnum = pgEnum('workflow_status', workflowStatusSchema.options);

export const sysWorkflows = pgTable('sys_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: varchar('name', { length: 255 }).notNull(),
  version: integer('version').default(1).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  yaml: text('yaml').notNull(),
  allowedRoles: text('allowed_roles').array(),
  allowedUsers: text('allowed_users').array(),
  status: workflowStatusEnum('status').default('draft').notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => tenantTable('sys_workflows', table));
