import { bigint, pgTable, serial, varchar, jsonb, text } from 'drizzle-orm/pg-core';
import { Resource } from "sst";
import { drizzle } from "drizzle-orm/aws-data-api/pg";
import { RDSDataClient } from "@aws-sdk/client-rds-data";

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
  databaseId: text('database_id').notNull(),
  databaseName: text('database_name').notNull(),
  databaseUrl: text('database_url').notNull(),
  databaseAuthToken: text('database_auth_token').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});
