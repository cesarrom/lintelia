import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, jsonb, timestamp, bigint, index, foreignKey } from 'drizzle-orm/pg-core';
import { tenantIdColumn } from '../rls';
import { tenantTable } from './_tenant-table';
import { cases } from './case.entity';

export type UploadPurpose = 'client_request_item' | 'case_document' | 'connector_document';
export type UploadStatus = 'pending' | 'uploaded' | 'scanning' | 'available' | 'rejected' | 'expired';

/** What the intake pipeline found and changed (shown to reviewers: "2 scripts removed"). */
export interface IntakeReport {
  sniffedType?: string | null;
  scan?: { result: 'clean' | 'infected' | 'error'; signature?: string | null; engine?: string | null };
  rescan?: { result: 'clean' | 'infected' | 'error'; signature?: string | null };
  sanitization?: { actions: string[]; engine?: string | null };
  reason?: string | null;
}

/**
 * Upload intents (docs/plans/07): declared before any byte is sent, authorised against the purpose (e.g. the open
 * client request item it answers), expiring after 15 minutes. Bytes land in quarantine and only become a case file
 * after the intake pipeline (sniff → scan → sanitise → rescan).
 */
export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  purpose: varchar('purpose', { length: 32 }).$type<UploadPurpose>().notNull(),
  ownerType: varchar('owner_type', { length: 16 }).$type<'client' | 'member' | 'connector'>().notNull(),
  ownerId: uuid('owner_id').notNull(),
  caseId: uuid('case_id'),
  taskId: uuid('task_id'),
  itemKey: varchar('item_key', { length: 128 }),
  declaredName: varchar('declared_name', { length: 255 }).notNull(),
  declaredSize: bigint('declared_size', { mode: 'number' }).notNull(),
  declaredType: varchar('declared_type', { length: 128 }).notNull(),
  declaredSha256: varchar('declared_sha256', { length: 64 }),
  /** What the document is for the case (e.g. `signed_agreement`, `proof_of_address`). */
  kind: varchar('kind', { length: 64 }),
  status: varchar('status', { length: 16 }).$type<UploadStatus>().default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  report: jsonb('report').$type<IntakeReport>().default(sql`'{}'::jsonb`).notNull(),
  fileId: uuid('file_id'),
  expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('uploads', table),
  index('uploads_owner_idx').on(table.tenantId, table.ownerId, table.status),
  foreignKey({ name: 'uploads_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
]);

/** Files of a case that passed intake: sanitised, scanned, stored in the clean area, downloadable through signed URLs. */
export const caseFiles = pgTable('case_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id').notNull(),
  taskId: uuid('task_id'),
  itemKey: varchar('item_key', { length: 128 }),
  uploadId: uuid('upload_id'),
  name: varchar('name', { length: 255 }).notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  contentType: varchar('content_type', { length: 128 }).notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  kind: varchar('kind', { length: 64 }),
  storageKey: text('storage_key').notNull(),
  source: varchar('source', { length: 16 }).$type<'client' | 'member' | 'connector'>().notNull(),
  uploadedById: uuid('uploaded_by_id'),
  uploadedByEmail: varchar('uploaded_by_email', { length: 320 }),
  report: jsonb('report').$type<IntakeReport>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('case_files', table),
  index('case_files_case_idx').on(table.tenantId, table.caseId),
  foreignKey({ name: 'case_files_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
]);
