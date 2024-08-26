import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { sqliteTable, integer, text, numeric } from "drizzle-orm/sqlite-core";
import { tenants, tenantsDB } from './tenants.sql';
import { eq, sql } from 'drizzle-orm';

export const getPlatformDB = async (tenantId: number) => {
  const [tenant] = await tenantsDB.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant) {
    throw new Error(`Tenant with id ${tenantId} not found`);
  }
  const turso = createClient({
    url: tenant.databaseUrl,
    authToken: tenant.databaseAuthToken,
  });

  const db = drizzle(turso);

  return db;
};

export type PlatformDB = Awaited<ReturnType<typeof getPlatformDB>>;

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash', { length: 255 }).notNull(),
  role: text('role').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Files table
export const files = sqliteTable('files', {
  id: integer('id').primaryKey(),
  user_id: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  name: text('name', { length: 255 }).notNull(),
  path: text('path', { length: 1024 }).notNull(),
  mime_type: text('mime_type', { length: 100 }).notNull(),
  size: numeric('size').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Forms table
export const forms = sqliteTable('forms', {
  id: integer('id').primaryKey(),
  user_id: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  title: text('title', { length: 255 }).notNull(),
  description: text('description'),
  schema: text('schema').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Form responses table
export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey(),
  form_id: integer('form_id', { mode: 'number' }).notNull().references(() => forms.id),
  user_id: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  data: text('data').notNull(),
  status: text('status').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Form response review table
export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey(),
  application_id: integer('application_id', { mode: 'number' }).notNull().references(() => applications.id),
  reviewer_id: integer('reviewer_id', { mode: 'number' }).notNull().references(() => users.id),
  status: text('status').notNull(),
  comments: text('comments'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Audit trail table
export const auditTrail = sqliteTable('audit_trail', {
  id: integer('id').primaryKey(),
  user_id: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  action: text('action', { length: 255 }).notNull(),
  entity_type: text('entity_type', { length: 50 }).notNull(),
  entity_id: integer('entity_id', { mode: 'number' }).notNull(),
  details: text('details'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

