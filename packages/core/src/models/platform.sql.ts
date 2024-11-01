import { sqliteTable, integer, text, numeric, int, unique, index } from "drizzle-orm/sqlite-core";
import { sql } from 'drizzle-orm';
import { primaryKey } from "drizzle-orm/sqlite-core";

// Users table
export const userRoles = sqliteTable('users_roles', {
  id: integer('id').primaryKey(),
  role: text('role').notNull(),
  userId: text('user_id').notNull(),
});

export const invitations = sqliteTable('invitations', {
  id: integer('id').primaryKey(),
  email: text('email').notNull(),
  purpose: text('purpose').notNull(),
  data: text('data').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Files table
export const files = sqliteTable('files', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name', { length: 255 }).notNull(),
  path: text('path', { length: 1024 }).notNull(),
  mimeType: text('mime_type', { length: 100 }).notNull(),
  size: numeric('size').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

export const applicantTypes = sqliteTable('applicant_types', {
  id: integer('id').primaryKey(),
  name: text('name', { length: 255 }).notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Forms table
export const forms = sqliteTable('forms', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title', { length: 255 }).notNull(),
  description: text('description'),
  purpose: text('purpose').notNull(),
  formKey: text('form_key').notNull(),
  dmnKey: text('dmn_key').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

export const validationFeatures = sqliteTable('validation_features', {
  id: text('id', { length: 255 }).notNull().primaryKey(),
  description: text('description'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// a feature in DB maps to business logic on the backend, and additional UI on the frontend
// planned features are:
// - face validation
// - voice validation
// - ID validation
// - document validation
// - risk analysis
// 

// we sell these features, so these are immutable from client side, and will be enabled by us, then the client can apply them to their forms if they want to
export const formsValidationFeatures = sqliteTable('form_features_validation', {
  formId: integer('form_id', { mode: 'number' }).notNull().references(() => forms.id),
  featureId: text('feature_id').notNull().references(() => validationFeatures.id),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, table => ({
  formsValidationFeaturesPk: primaryKey({ columns: [table.formId, table.featureId] }),
}));

export const formsAdditionalRequests = sqliteTable('form_additional_requests', {
  id: integer('id').primaryKey(),
  formId: integer('form_id', { mode: 'number' }).notNull().references(() => forms.id),
  title: text('title', { length: 255 }).notNull(),
  description: text('description'),
  type: text('type', { length: 255 }).notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Form responses table
export const applications = sqliteTable('applications', {
  id: integer('id').primaryKey(),
  applicationPurpose: text('application_purpose').notNull(),
  formId: integer('form_id', { mode: 'number' }).notNull().references(() => forms.id),
  parentApplicationId: integer('parent_application_id', { mode: 'number' }).references(() => applications.id),
  data: text('data').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
},
  table => ({
    formIdIdx: index('applications__form_id_idx').on(table.formId),
    parentApplicationIdIdx: index('applications__parent_application_id_idx').on(table.parentApplicationId),
    statusIdx: index('applications__status_idx').on(table.status),
    purposeIdx: index('applications__purpose_idx').on(table.applicationPurpose),
  })
);

export const applicants = sqliteTable('applicants', {
  userId: text('user_id').notNull(),
  applicationId: integer('application_id', { mode: 'number' }).notNull().references(() => applications.id),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, table => ({
  applicantsPk: primaryKey({ columns: [table.userId, table.applicationId] }),
  applicationIdIdx: index('applicants__application_id_idx').on(table.applicationId),
  userIdIdx: index('applicants__user_id_idx').on(table.userId),
  userApplicationIdIdx: index('applicants__user_application_id_idx').on(table.userId, table.applicationId),
}));

export const applicationValidationFeatures = sqliteTable('application_validation_features', {
  applicationId: integer('application_id', { mode: 'number' }).notNull().references(() => applications.id),
  featureId: text('feature_id').notNull().references(() => validationFeatures.id),
  data: text('data').notNull(),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
}, (table) => ({
  applicationValidationFeaturePk: primaryKey({ columns: [table.applicationId, table.featureId] }),
}));

export const applicationsAdditionalRequests = sqliteTable('applications_additional_requests', {
  id: integer('id').primaryKey(),
  applicationId: integer('application_id', { mode: 'number' }).notNull().references(() => applications.id),
  type: text('type', { length: 255 }).notNull(),
  status: text('status').notNull(),
  response: text('response'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Form response review table
export const reviews = sqliteTable('reviews', {
  id: integer('id').primaryKey(),
  applicationId: integer('application_id', { mode: 'number' }).notNull().references(() => applications.id),
  reviewerId: integer('reviewer_id', { mode: 'number' }).notNull(),
  status: text('status').notNull(),
  comments: text('comments'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$onUpdate(() => new Date()),
});

// Audit trail table
export const auditTrail = sqliteTable('audit_trail', {
  id: integer('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action', { length: 255 }).notNull(),
  entityType: text('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id', { mode: 'number' }).notNull(),
  details: text('details'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

