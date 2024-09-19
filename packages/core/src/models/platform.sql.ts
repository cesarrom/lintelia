import { sqliteTable, integer, text, numeric } from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email', { length: 255 }).notNull().unique(),
  role: text('role').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toString()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Files table
export const files = sqliteTable('files', {
  id: integer('id').primaryKey(),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  name: text('name', { length: 255 }).notNull(),
  path: text('path', { length: 1024 }).notNull(),
  mimeType: text('mime_type', { length: 100 }).notNull(),
  size: numeric('size').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Forms table
export const forms = sqliteTable('forms', {
  id: integer('id').primaryKey(),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  title: text('title', { length: 255 }).notNull(),
  description: text('description'),
  schema: text('schema').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Form responses table
export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey(),
  formId: integer('form_id', { mode: 'number' }).notNull().references(() => forms.id),
  userId: text('user_id').notNull().references(() => users.id),
  data: text('data').notNull(),
  verificationWorkflowId: text('verification_workflow_id'),
  verificationWorkflowRunId: text('verification_workflow_run_id'),
  verificationApplicantId: text('verification_applicant_id'),
  verificationStatus: text('verification_status'),
  status: text('status').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Form response review table
export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey(),
  applicationId: integer('application_id', { mode: 'number' }).notNull().references(() => applications.id),
  reviewerId: integer('reviewer_id', { mode: 'number' }).notNull().references(() => users.id),
  status: text('status').notNull(),
  comments: text('comments'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Audit trail table
export const auditTrail = sqliteTable('audit_trail', {
  id: integer('id').primaryKey(),
  userId: integer('user_id', { mode: 'number' }).notNull().references(() => users.id),
  action: text('action', { length: 255 }).notNull(),
  entityType: text('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id', { mode: 'number' }).notNull(),
  details: text('details'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

