import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysFormInstances } from './form-instance.entity'; // Import the Drizzle table

export const sysFormAnswers = pgTable('sys_form_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  formInstanceId: uuid('form_instance_id')
    .notNull()
    .references(() => sysFormInstances.id, { onDelete: 'cascade' }), // Define FK relationship, assuming cascade delete
  fieldId: varchar('field_id').notNull(), // Assuming varchar, adjust length if needed
  value: jsonb('value').$type<any>().notNull(), // Use jsonb, specify type if known, otherwise any
  createdBy: varchar('created_by').notNull(), // Assuming varchar, adjust length if needed
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Define relationships
export const sysFormAnswersRelations = relations(sysFormAnswers, ({ one }) => ({
  formInstance: one(sysFormInstances, {
    fields: [sysFormAnswers.formInstanceId],
    references: [sysFormInstances.id],
  }),
}));
