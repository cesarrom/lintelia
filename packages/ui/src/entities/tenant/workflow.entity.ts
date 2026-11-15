import { pgTable, uuid, varchar, integer, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { workflowStatusSchema } from '../../schemas/shared.schema';

// Define ENUM values for Drizzle
export const workflowStatusEnum = pgEnum('workflow_status', workflowStatusSchema.options);


export const sysWorkflows = pgTable('sys_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  version: integer('version').default(1).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  yaml: text('yaml').notNull(),
  allowedRoles: text('allowed_roles').array(), // Use specificType for arrays
  allowedUsers: text('allowed_users').array(), // Use specificType for arrays
  status: workflowStatusEnum('status').default('draft').notNull(),
  createdBy: varchar('created_by').notNull(), // Assuming varchar is appropriate, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});
