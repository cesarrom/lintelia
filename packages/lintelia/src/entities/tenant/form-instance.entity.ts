import { pgTable, uuid, varchar, timestamp, jsonb, pgEnum, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysForms } from './form.entity';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const formInstanceStatusEnum = pgEnum('form_instance_status', ['draft', 'submitted']);

export const sysFormInstances = pgTable('sys_form_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  formId: uuid('form_id').notNull(),
  answers: jsonb('answers').$type<Record<string, any>>(),
  variables: jsonb('variables').$type<Record<string, unknown>>(),
  submittedBy: varchar('submitted_by').notNull(),
  status: formInstanceStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_form_instances', table),
  foreignKey({ name: 'sys_form_instances_form_fk', columns: [table.tenantId, table.formId], foreignColumns: [sysForms.tenantId, sysForms.id] }).onDelete('cascade'),
]);

export const sysFormInstanceRelations = relations(sysFormInstances, ({ one }) => ({
  form: one(sysForms, {
    fields: [sysFormInstances.formId],
    references: [sysForms.id],
  }),
}));
