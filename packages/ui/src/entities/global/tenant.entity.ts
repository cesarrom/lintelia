import { pgTable, serial, varchar, jsonb, text, timestamp } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull(),
  logoUrl: varchar('logo_url', { length: 255 }).notNull(),
  pallette: jsonb('pallette').$type<{ primary: string; secondary: string; accent: string; }>().notNull(),
  allowedDomains: text('allowed_domains').array().default([]).notNull(), // Array of text, default empty
  databaseId: varchar('database_id').notNull(), // Assuming varchar is sufficient
  databaseUrl: varchar('database_url').notNull(), // Assuming varchar is sufficient
  databasePassword: varchar('database_password').notNull(), // Assuming varchar is sufficient
  addressLine1: varchar('address_line_1', { length: 255 }).notNull(),
  addressLine2: varchar('address_line_2', { length: 255 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  country: varchar('country', { length: 255 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  zipCode: varchar('zip_code', { length: 255 }).notNull(),
  startWorkingHour: varchar('start_working_hour', { length: 255 }).notNull(),
  endWorkingHour: varchar('end_working_hour', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});