import { pgTable, uuid, varchar, timestamp, jsonb, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sysFormInstances } from './form-instance.entity';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';

export const sysFormAnswers = pgTable('sys_form_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  formInstanceId: uuid('form_instance_id').notNull(),
  fieldId: varchar('field_id').notNull(),
  value: jsonb('value').$type<any>().notNull(),
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('sys_form_answers', table),
  foreignKey({ name: 'sys_form_answers_form_instance_fk', columns: [table.tenantId, table.formInstanceId], foreignColumns: [sysFormInstances.tenantId, sysFormInstances.id] }).onDelete('cascade'),
]);

export const sysFormAnswersRelations = relations(sysFormAnswers, ({ one }) => ({
  formInstance: one(sysFormInstances, {
    fields: [sysFormAnswers.formInstanceId],
    references: [sysFormInstances.id],
  }),
}));
