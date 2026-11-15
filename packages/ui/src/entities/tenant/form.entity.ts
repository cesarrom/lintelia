import { pgTable, uuid, varchar, text, timestamp, json, jsonb } from 'drizzle-orm/pg-core';
import { type FormConfig } from '../../schemas/forms.schema.js';

export const sysForms = pgTable('sys_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'), // Nullable by default
  config: json('config').$type<FormConfig>().notNull(), // Use json and specify type
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  variables: jsonb('variables').$type<Record<string, string>>(), // Use jsonb and specify type, nullable by default
});

