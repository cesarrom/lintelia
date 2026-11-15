import { pgTable, uuid, varchar, jsonb, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const sysInvitations = pgTable('sys_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email').notNull(), // Uniqueness handled by index below
  roleId: varchar('role_id').notNull(), // Assuming varchar, adjust length if needed
  data: jsonb('data').$type<Record<string, unknown>>(), // Nullable by default
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
},
(table) => {
  return {
    // Define unique index on the 'email' column
    emailIdx: uniqueIndex('sys_invitations_email_idx').on(table.email),
  };
});