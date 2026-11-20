import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { LogCategory, logLevelSchema } from '../../schemas/shared.schema';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const logLevelEnum = pgEnum('log_level', logLevelSchema.options);

export const sysLogs = pgTable('sys_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  message: varchar('message', { length: 255 }).notNull(),
  details: text('details'),
  level: logLevelEnum('level').default('info').notNull(),
  category: varchar('category', { length: 255 }).default('system').notNull().$type<LogCategory>(),
  source: varchar('source', { length: 255 }),
  userId: varchar('userId', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  acknowledged: boolean('acknowledged').default(false).notNull(),
  acknowledgedBy: varchar('acknowledgedBy'),
  acknowledgedAt: timestamp('acknowledgedAt', { mode: 'date', withTimezone: true }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_logs', table),
  index('sys_logs_tenant_created_at_idx').on(table.tenantId, table.createdAt),
]);
