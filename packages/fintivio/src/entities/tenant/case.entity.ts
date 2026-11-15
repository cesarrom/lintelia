import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, foreignKey, uniqueIndex, index, bigint } from 'drizzle-orm/pg-core';
import { tenantIdColumn, tenantIsolationPolicy } from '../rls';
import { tenantTable } from './_tenant-table';
import { sysWorkflows } from './workflow.entity';
import { users } from './user.entity';
import { tenants } from '../global/tenant.entity';

/** Published, immutable workflow definitions. `sys_workflows.yaml` is the draft being edited. */
export const workflowVersions = pgTable('workflow_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  workflowId: uuid('workflow_id').notNull(),
  version: integer('version').notNull(),
  yaml: text('yaml').notNull(),
  /** `active` (the version new executions use) or `retired`. */
  status: varchar('status', { length: 32 }).$type<'active' | 'retired'>().default('active').notNull(),
  /** Platform events that start this workflow (e.g. `client.flagged`). */
  startOn: text('start_on').array().default(sql`'{}'::text[]`).notNull(),
  publishedBy: varchar('published_by', { length: 320 }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  ...tenantTable('workflow_versions', table),
  uniqueIndex('workflow_versions_version_idx').on(table.tenantId, table.workflowId, table.version),
  foreignKey({ name: 'workflow_versions_workflow_fk', columns: [table.tenantId, table.workflowId], foreignColumns: [sysWorkflows.tenantId, sysWorkflows.id] }).onDelete('cascade'),
]);

export type CaseStatus = 'draft' | 'submitted' | 'in_progress' | 'pending_client' | 'in_review' | 'approved' | 'rejected'
  | 'closed' | 'completed' | 'expired' | 'withdrawn' | 'failed';

export const FINAL_CASE_STATUSES: CaseStatus[] = ['approved', 'rejected', 'closed', 'completed', 'expired', 'withdrawn', 'failed'];

/**
 * A case is the business object a workflow execution works on (an application, an investigation). One durable
 * execution per case; the execution id is the case id.
 */
export const cases = pgTable('cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  reference: varchar('reference', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  workflowId: uuid('workflow_id').notNull(),
  workflowVersion: integer('workflow_version').notNull(),
  status: varchar('status', { length: 32 }).$type<CaseStatus>().default('draft').notNull(),
  /** Business outcome set by the workflow (e.g. `pre_approved`, `sar_filed`). */
  outcome: varchar('outcome', { length: 64 }),
  riskLevel: varchar('risk_level', { length: 16 }),
  flags: text('flags').array().default(sql`'{}'::text[]`).notNull(),
  applicantId: uuid('applicant_id'),
  applicantEmail: varchar('applicant_email', { length: 320 }),
  applicantName: varchar('applicant_name', { length: 255 }),
  /** member | client | public | api | event */
  initiatedByType: varchar('initiated_by_type', { length: 16 }).notNull(),
  initiatedById: varchar('initiated_by_id', { length: 64 }),
  initiatedByEmail: varchar('initiated_by_email', { length: 320 }),
  /**
   * What the client (applicant/subject) sees in their portal: `full` (applications) or `requests_only` (investigations:
   * only neutral information requests, never the case; AML tipping-off rules).
   */
  clientVisibility: varchar('client_visibility', { length: 16 }).$type<'full' | 'requests_only'>().default('full').notNull(),
  /** Child cases (a sub-workflow per party, `workflow.call`/`foreach`): the parent case and the step waiting for them. */
  parentCaseId: uuid('parent_case_id'),
  parentStepId: varchar('parent_step_id', { length: 128 }),
  /** Durable promise of the parent step resolved when this child case ends. */
  parentPromise: varchar('parent_promise', { length: 160 }),
  /** How the case started: `form:<id>`, `event:client.flagged`, `manual`, `api`, `assisted`, `child:<parent step>`. */
  source: varchar('source', { length: 128 }).notNull(),
  /** Inputs (form answers, event payload). */
  data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  /** Consents the applicant gave (privacy notice version, application confirmation...), with timestamps. */
  consents: jsonb('consents').$type<Array<{ document: string; version: string; acceptedAt: string; channel?: string }>>().default(sql`'[]'::jsonb`).notNull(),
  /** Outputs of completed steps, by step id. */
  results: jsonb('results').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
}, (table) => [
  ...tenantTable('cases', table),
  uniqueIndex('cases_reference_idx').on(table.tenantId, table.reference),
  index('cases_status_idx').on(table.tenantId, table.status),
  index('cases_applicant_idx').on(table.tenantId, table.applicantId),
  index('cases_parent_idx').on(table.tenantId, table.parentCaseId),
  foreignKey({ name: 'cases_workflow_fk', columns: [table.tenantId, table.workflowId], foreignColumns: [sysWorkflows.tenantId, sysWorkflows.id] }),
  foreignKey({ name: 'cases_applicant_fk', columns: [table.tenantId, table.applicantId], foreignColumns: [users.tenantId, users.id] }),
]);

export type TaskStatus = 'open' | 'claimed' | 'pending_second_approval' | 'pending_client' | 'escalated' | 'completed' | 'cancelled' | 'expired';

export interface TaskOutcome {
  key: string;
  label: string;
  /** A reason must be written (rejections, escalations). */
  requiresReason?: boolean;
  /** Positive outcomes of `authority: high` tasks need a second approver. */
  needsSecondApproval?: boolean;
}

/** Human steps: reviews routed to members (`audience: member`) and requests to the client (`audience: client`). */
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id').notNull(),
  stepId: varchar('step_id', { length: 128 }).notNull(),
  audience: varchar('audience', { length: 16 }).$type<'member' | 'client'>().default('member').notNull(),
  kind: varchar('kind', { length: 32 }).default('review').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 }).$type<TaskStatus>().default('open').notNull(),
  queueRole: varchar('queue_role', { length: 255 }),
  assigneeId: uuid('assignee_id'),
  authority: varchar('authority', { length: 16 }).$type<'standard' | 'high'>().default('standard').notNull(),
  outcomes: jsonb('outcomes').$type<TaskOutcome[]>().default(sql`'[]'::jsonb`).notNull(),
  dueAt: timestamp('due_at', { mode: 'date', withTimezone: true }),
  escalateToRole: varchar('escalate_to_role', { length: 255 }),
  escalatedAt: timestamp('escalated_at', { mode: 'date', withTimezone: true }),
  firstDecision: jsonb('first_decision').$type<{ outcome: string; by: string; byEmail: string; reason?: string; at: string } | null>(),
  decision: varchar('decision', { length: 64 }),
  decisionReason: text('decision_reason'),
  decidedById: uuid('decided_by_id'),
  decidedByEmail: varchar('decided_by_email', { length: 320 }),
  decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
  /** Client requests: what is asked (fields/files); member reviews: the open request to the client, if any. */
  requestItems: jsonb('request_items').$type<Array<{ key: string; label: string; type: 'text' | 'file' }>>(),
  response: jsonb('response').$type<Record<string, unknown>>(),
  parentTaskId: uuid('parent_task_id'),
  /** Client steps of connectors: what the portal shows (redirect, embedded page, vendor SDK). */
  /** Routing rules kept with the task (e.g. `sameAssigneeAs: siblings`: one person handles the step for every item). */
  routing: jsonb('routing').$type<{ sameAssigneeAs?: 'siblings' } | null>(),
  clientAction: jsonb('client_action').$type<{ type: 'redirect' | 'embed' | 'sdk'; url: string; title?: string; instructions?: string; sdk?: string } | null>(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('tasks', table),
  index('tasks_queue_idx').on(table.tenantId, table.status, table.queueRole),
  index('tasks_assignee_idx').on(table.tenantId, table.assigneeId),
  foreignKey({ name: 'tasks_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
]);

/**
 * Append-only audit trail (the application role can INSERT and SELECT, never UPDATE/DELETE). Each entry stores the
 * hash of the previous entry of the same tenant, so tampering breaks the chain. Case timelines are the entries of a
 * case.
 */
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  seq: bigint('seq', { mode: 'number' }).notNull(),
  at: timestamp('at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  /** member | client | staff | workflow | api | public | system */
  actorType: varchar('actor_type', { length: 16 }).notNull(),
  actorId: varchar('actor_id', { length: 64 }),
  actorEmail: varchar('actor_email', { length: 320 }),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }),
  targetId: varchar('target_id', { length: 64 }),
  caseId: uuid('case_id'),
  details: jsonb('details').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  previousHash: varchar('previous_hash', { length: 64 }),
  hash: varchar('hash', { length: 64 }).notNull(),
}, (table) => [
  uniqueIndex('audit_events_seq_idx').on(table.tenantId, table.seq),
  index('audit_events_case_idx').on(table.tenantId, table.caseId),
  foreignKey({ name: 'audit_events_tenant_fk', columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  tenantIsolationPolicy('audit_events'),
]);

/**
 * Data-rights requests of clients (GDPR art. 15/17 style): a copy of their data or its erasure, handled by compliance
 * (`data_requests:manage`). Erasure anonymises the profile unless records must be kept (open cases, investigations).
 */
export const dataRequests = pgTable('data_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  clientId: uuid('client_id').notNull(),
  type: varchar('type', { length: 16 }).$type<'export' | 'erasure'>().notNull(),
  status: varchar('status', { length: 16 }).$type<'open' | 'completed' | 'rejected'>().default('open').notNull(),
  /** Why a request was rejected (e.g. records under legal retention). */
  resolution: text('resolution'),
  /** The export prepared for the client (export requests). */
  result: jsonb('result').$type<Record<string, unknown>>(),
  requestedAt: timestamp('requested_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'date', withTimezone: true }),
  completedByEmail: varchar('completed_by_email', { length: 320 }),
}, (table) => [
  ...tenantTable('data_requests', table),
  index('data_requests_status_idx').on(table.tenantId, table.status),
  foreignKey({ name: 'data_requests_client_fk', columns: [table.tenantId, table.clientId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);

export type PartyStatus = 'invited' | 'in_progress' | 'completed' | 'declined' | 'removed';

/**
 * People related to a case besides the applicant (co-applicants, guarantors, directors, UBOs, signatories), each a
 * client of the institution who only sees their own part (docs/plans/06).
 */
export const caseParties = pgTable('case_parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  caseId: uuid('case_id').notNull(),
  personId: uuid('person_id').notNull(),
  role: varchar('role', { length: 64 }).notNull(),
  status: varchar('status', { length: 16 }).$type<PartyStatus>().default('invited').notNull(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 320 }).notNull(),
  /** What the party submitted (their own part only). */
  data: jsonb('data').$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
  /** e.g. ownership percentage of a UBO. */
  share: integer('share'),
  /** The child case running this party's own workflow, when any. */
  childCaseId: uuid('child_case_id'),
  invitedBy: varchar('invited_by', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  ...tenantTable('case_parties', table),
  uniqueIndex('case_parties_person_idx').on(table.tenantId, table.caseId, table.personId, table.role),
  index('case_parties_person_lookup_idx').on(table.tenantId, table.personId),
  foreignKey({ name: 'case_parties_case_fk', columns: [table.tenantId, table.caseId], foreignColumns: [cases.tenantId, cases.id] }).onDelete('cascade'),
  foreignKey({ name: 'case_parties_person_fk', columns: [table.tenantId, table.personId], foreignColumns: [users.tenantId, users.id] }).onDelete('cascade'),
]);
