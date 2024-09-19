import { bigint, pgTable, serial, varchar, jsonb, text } from 'drizzle-orm/pg-core';
import { Resource } from "sst";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { sql } from 'drizzle-orm';

const client = new RDSDataClient({});

export const tenantsDB = drizzle(client, {
  database: Resource.Database.database,
  secretArn: Resource.Database.secretArn,
  resourceArn: Resource.Database.clusterArn,
});

// Tenants table
export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 255 }).notNull().unique(),
  logoUrl: varchar('logo_url', { length: 255 }).notNull(),
  pallette: jsonb('pallette').notNull(),
  allowedDomains: jsonb('allowed_domains').notNull().$defaultFn(() => []),
  databaseId: text('database_id').notNull(),
  databaseName: text('database_name').notNull(),
  databaseUrl: text('database_url').notNull(),
  addressLine1: varchar('address_line_1', { length: 255 }).notNull(),
  addressLine2: varchar('address_line_2', { length: 255 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  country: varchar('country', { length: 255 }).notNull(),
  state: varchar('state', { length: 255 }).notNull(),
  zipCode: varchar('zip_code', { length: 255 }).notNull(),
  startWorkingHour: varchar('start_working_hour', { length: 255 }).notNull(),
  endWorkingHour: varchar('end_working_hour', { length: 255 }).notNull(),
  databaseAuthToken: text('database_auth_token').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull().$defaultFn(() => new Date().getTime()),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull().$defaultFn(() => new Date().getTime()).$onUpdateFn(() => new Date().getTime()),
});

export const defaultForms = pgTable('default_forms', {
  id: serial('id').primaryKey(),
  purpose: varchar('purpose', { length: 255 }).notNull(),
  formData: jsonb('form_data').notNull(),
  version: bigint('version', { mode: 'number' }).notNull().default(sql`EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000`),
});

export const environments = pgTable('environments', {
  name: varchar('name', { length: 255 }).primaryKey(),
  distributionArn: text('distribution_arn').notNull(),
});
