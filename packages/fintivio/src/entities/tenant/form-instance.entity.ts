import { pgTable, uuid, varchar, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysForms } from './form.entity'; // Import the Drizzle table

// Define ENUM values for Drizzle
export const formInstanceStatusEnum = pgEnum('form_instance_status', ['draft', 'submitted']);

export const sysFormInstances = pgTable('sys_form_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  formId: uuid('form_id')
    .notNull()
    .references(() => sysForms.id, { onDelete: 'cascade' }), // Define FK relationship, assuming cascade delete
  answers: jsonb('answers').$type<Record<string, any>>(), // Nullable by default
  variables: jsonb('variables').$type<Record<string, unknown>>(), // Nullable by default
  submittedBy: varchar('submitted_by').notNull(), // Assuming varchar, adjust length if needed
  status: formInstanceStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Define relationships
export const sysFormInstanceRelations = relations(sysFormInstances, ({ one }) => ({
  form: one(sysForms, {
    fields: [sysFormInstances.formId],
    references: [sysForms.id],
  }),
}));
