import { pgTable, uuid, varchar, text, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm'; // Import sql for default values
import { EvidenceItem, ReviewItem, reviewStatusValuesSchema } from '../../schemas/shared.schema';


// Define ENUM values for Drizzle
export const reviewStatusEnum = pgEnum('review_status', reviewStatusValuesSchema.options);

export const sysReviews = pgTable('sys_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(), // Assuming max length 255
  description: text('description'), // Nullable
  status: reviewStatusEnum('status').default('pending').notNull(),
  assignedTo: varchar('assigned_to', { length: 255 }), // Nullable, assuming max length 255
  assignedAt: timestamp('assigned_at', { mode: 'date', withTimezone: true }), // Nullable
  completedBy: varchar('completed_by', { length: 255 }), // Nullable, assuming max length 255
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }), // Nullable
  comments: text('comments'), // Nullable
  rejectionReason: text('rejection_reason'), // Nullable
  additionalDataRequest: text('additional_data_request'), // Nullable
  reviewItems: jsonb('review_items')
    .$type<ReviewItem[]>()
    .default(sql`'[]'::jsonb`) // Use sql for default JSONB array
    .notNull(),
  evidence: jsonb('evidence').$type<EvidenceItem[]>(), // Nullable
  dueDate: timestamp('due_date', { mode: 'date', withTimezone: true }), // Nullable
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});