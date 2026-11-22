import { and, desc, eq, max, isNotNull, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { cases, tasks, users, workflowVersions, FINAL_CASE_STATUSES, type CaseStatus, type TaskOutcome, caseParties } from '../entities';
import type { Databases } from '../clients/database.client';
import { parseDefinition } from './definition';

export type CaseRow = typeof cases.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type NewCase = Omit<typeof cases.$inferInsert, 'reference' | 'tenantId'> & { reference?: string };

export const DEFAULT_REVIEW_OUTCOMES = (requireReasonOnReject = true): TaskOutcome[] => [
  { key: 'approve', label: 'Approve', needsSecondApproval: true },
  { key: 'reject', label: 'Reject', requiresReason: requireReasonOnReject },
  { key: 'request_info', label: 'Request information from the client', requiresReason: true },
];

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCaseReference = (prefix = 'C') => {
  const bytes = randomBytes(6);
  return `${prefix}-${new Date().getUTCFullYear()}-${[...bytes].map((b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]).join('')}`;
};

export const isFinalStatus = (status: string) => FINAL_CASE_STATUSES.includes(status as CaseStatus);

/** Case and task persistence, shared by the case engine (Restate) and the API services. Always tenant-scoped. */
export class CaseRepository {
  constructor(private readonly databases: Databases) { }

  db(tenantId: string) {
    return this.databases.forTenant(tenantId);
  }

  async createCase(tenantId: string, values: NewCase): Promise<CaseRow> {
    const [row] = await this.db(tenantId).insert(cases).values({ ...values, reference: values.reference ?? newCaseReference() }).returning();
    return row;
  }

  async getCase(tenantId: string, caseId: string): Promise<CaseRow | null> {
    const [row] = await this.db(tenantId).select().from(cases).where(eq(cases.id, caseId)).limit(1);
    return row ?? null;
  }

  async updateCase(tenantId: string, caseId: string, changes: Partial<CaseRow>): Promise<CaseRow> {
    const [row] = await this.db(tenantId).update(cases).set(changes).where(eq(cases.id, caseId)).returning();
    return row;
  }

  async saveResult(tenantId: string, caseId: string, stepId: string, output: unknown) {
    const kase = await this.getCase(tenantId, caseId);
    if (!kase) return;
    await this.updateCase(tenantId, caseId, { results: { ...kase.results, [stepId]: output ?? null } });
  }

  async activeVersion(tenantId: string, workflowId: string) {
    const [row] = await this.db(tenantId).select().from(workflowVersions)
      .where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active')))
      .orderBy(desc(workflowVersions.version)).limit(1);
    return row ?? null;
  }

  async version(tenantId: string, workflowId: string, version: number) {
    const [row] = await this.db(tenantId).select().from(workflowVersions)
      .where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.version, version))).limit(1);
    return row ?? null;
  }

  async latestVersionNumber(tenantId: string, workflowId: string) {
    const [row] = await this.db(tenantId).select({ value: max(workflowVersions.version) }).from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId));
    return row?.value ?? 0;
  }

  /** Idempotent on the task id (the engine derives ids from Restate's deterministic random). */
  async createTask(tenantId: string, values: typeof tasks.$inferInsert & { id: string }): Promise<TaskRow> {
    await this.db(tenantId).insert(tasks).values(values).onConflictDoNothing();
    return (await this.getTask(tenantId, values.id))!;
  }

  async getTask(tenantId: string, taskId: string): Promise<TaskRow | null> {
    const [row] = await this.db(tenantId).select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    return row ?? null;
  }

  async updateTask(tenantId: string, taskId: string, changes: Partial<TaskRow>): Promise<TaskRow> {
    const [row] = await this.db(tenantId).update(tasks).set(changes).where(eq(tasks.id, taskId)).returning();
    return row;
  }

  async userById(tenantId: string, userId: string) {
    const [row] = await this.db(tenantId).select().from(users).where(eq(users.id, userId)).limit(1);
    return row ?? null;
  }

  async memberByEmail(tenantId: string, email: string) {
    const [row] = await this.db(tenantId).select().from(users).where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, eq(users.kind, 'member'))).limit(1);
    return row ?? null;
  }

  // --- parties (docs/plans/06) --------------------------------------------------------------------------------------

  async partiesOfCase(tenantId: string, caseId: string) {
    return this.db(tenantId).select().from(caseParties).where(eq(caseParties.caseId, caseId)).orderBy(caseParties.createdAt);
  }

  async getParty(tenantId: string, partyId: string) {
    const [row] = await this.db(tenantId).select().from(caseParties).where(eq(caseParties.id, partyId)).limit(1);
    return row ?? null;
  }

  async updateParty(tenantId: string, partyId: string, changes: Partial<typeof caseParties.$inferInsert>) {
    const [row] = await this.db(tenantId).update(caseParties).set(changes).where(eq(caseParties.id, partyId)).returning();
    return row ?? null;
  }

  /** Who handles this step for the sibling cases (same parent case): sticky routing of `task` steps. */
  async siblingAssignee(tenantId: string, caseId: string, stepId: string): Promise<string | null> {
    const kase = await this.getCase(tenantId, caseId);
    if (!kase?.parentCaseId) return null;
    const [row] = await this.db(tenantId).select({ assigneeId: tasks.assigneeId }).from(tasks)
      .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
      .where(and(eq(cases.parentCaseId, kase.parentCaseId), eq(tasks.stepId, stepId), isNotNull(tasks.assigneeId)))
      .orderBy(tasks.createdAt).limit(1);
    return row?.assigneeId ?? null;
  }

  async tasksOfCase(tenantId: string, caseId: string) {
    return this.db(tenantId).select().from(tasks).where(eq(tasks.caseId, caseId)).orderBy(tasks.createdAt);
  }
}

/**
 * Values computed by `calculate` steps (affordability, scores...) and returned by connector steps (data looked up in
 * the institution's systems), keyed by step name, for reviewers. Other step results (conditions, notifications,
 * decisions) are internal to the engine.
 */
export async function calculationsOf(repository: CaseRepository, tenantId: string, kase: CaseRow): Promise<Array<{ step: string; name: string; values: Record<string, unknown> }>> {
  const version = await repository.version(tenantId, kase.workflowId, kase.workflowVersion);
  if (!version) return [];
  const results = (kase.results ?? {}) as Record<string, unknown>;
  return parseDefinition(version.yaml).steps
    .filter((step) => (step.type === 'calculate' || step.type.startsWith('connector:')) && results[step.id] && typeof results[step.id] === 'object')
    .map((step) => ({ step: step.id, name: step.name, values: results[step.id] as Record<string, unknown> }));
}
