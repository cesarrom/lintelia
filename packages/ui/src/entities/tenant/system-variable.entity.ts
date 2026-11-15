import { pgTable, uuid, varchar, timestamp, pgEnum, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { basicValueTypeSchema, complexValueTypeSchema, RecursiveValue } from '../../schemas/workflows.schema';


// Define ENUM values for Drizzle
export const systemVariableTypeEnum = pgEnum('system_variable_type', [...basicValueTypeSchema.options, ...complexValueTypeSchema.options]);

export const sysSystemVariables = pgTable('sys_system_variables', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(), // Uniqueness handled by index below
  description: varchar('description', { length: 255 }).notNull(),
  type: systemVariableTypeEnum('type').notNull(),
  value: jsonb('value').$type<RecursiveValue>().notNull(), // Assuming 'any' is acceptable, specify if known
  isProtected: boolean('isProtected').default(false).notNull(), // Matches Sequelize field name
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
},
(table) => {
  return {
    // Define unique index on the 'name' column
    nameIdx: uniqueIndex('sys_system_variables_name_idx').on(table.name),
  };
});