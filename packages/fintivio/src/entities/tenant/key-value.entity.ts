import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const sysKeyValues = pgTable('sys_key_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull(),
  value: text('value').notNull(),
  description: text('description'), // Nullable by default
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});
