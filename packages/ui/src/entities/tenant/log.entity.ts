import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb, boolean } from 'drizzle-orm/pg-core';
import { LogCategory, logLevelSchema } from '../../schemas/shared.schema';

// Define ENUM values for Drizzle
export const logLevelEnum = pgEnum('log_level', logLevelSchema.options);

export const sysLogs = pgTable('sys_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  message: varchar('message', { length: 255 }).notNull(),
  details: text('details'), // Nullable by default
  level: logLevelEnum('level').default('info').notNull(),
  // Use varchar based on comment, but retain TS type
  category: varchar('category', { length: 255 }).default('system').notNull().$type<LogCategory>(),
  source: varchar('source', { length: 255 }), // Nullable by default
  userId: varchar('userId', { length: 255 }), // Nullable by default, matches field name
  metadata: jsonb('metadata').$type<Record<string, any>>(), // Nullable by default
  acknowledged: boolean('acknowledged').default(false).notNull(),
  acknowledgedBy: varchar('acknowledgedBy'), // Nullable by default, assuming varchar
  acknowledgedAt: timestamp('acknowledgedAt', { mode: 'date', withTimezone: true }), // Nullable by default
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});
