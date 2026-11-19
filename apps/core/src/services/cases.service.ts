import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq, exists, inArray, notInArray, or, sql, type SQL } from 'drizzle-orm';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { caseFiles, caseRecords, cases, sysWorkflows, tasks, users, workflowVersions } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from '../engine/engine.client';
import { CaseRepository, calculationsOf, type CaseRow, type TaskRow } from '../engine/case-repository';
import { parseDefinition, renderCaseTitle } from '../engine/definition';
import { interpolate } from '../engine/expressions';
import { AuditWriter, type AuditActor } from './audit.writer';
import { NOTIFIER } from '../engine/providers';
import type { Notifier } from '../engine/notifier';
import { randomUUID } from 'node:crypto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { allows, hiddenWorkflowIds, startRuleOf, subjectOf } from '../access/rules';
import { PartiesService } from './parties.service';

export interface StartCaseInput {
  workflowId: string;
  data: Record<string, unknown>;
  applicant?: { id?: string | null; email?: string | null; name?: string | null } | null;
  source: string;
  initiatedBy: AuditActor;
  /** `draft` cases wait for the applicant to confirm their e-mail before the workflow starts. */
  draft?: boolean;
}

const toTaskSummary = (task: TaskRow, emails: Map<string, string>) => ({
  id: task.id,
  caseId: task.caseId,
  stepId: task.stepId,
  audience: task.audience,
  kind: task.kind,
  title: task.title,
  description: task.description,
  status: task.status,
  queue: task.queueRole ? { role: task.queueRole } : null,
  assignee: task.assigneeId ? { id: task.assigneeId, email: emails.get(task.assigneeId) ?? null } : null,
  authority: task.authority,
  outcomes: task.outcomes,
  dueAt: task.dueAt,
  escalatedAt: task.escalatedAt,
  firstDecision: task.firstDecision,
  decision: task.decision,
  decisionReason: task.decisionReason,
  decidedBy: task.decidedByEmail,
  decidedAt: task.decidedAt,
  requestItems: task.requestItems,
  response: task.response,
  parentTaskId: task.parentTaskId,
  /** Staff screens (`team.screen`): the form to fill. */
  screen: task.kind === 'screen' && task.audience === 'member' ? task.screen : null,
  createdAt: task.createdAt,
});

/** Decisions of a case in order (first approvals of four-eyes tasks included). */
export const caseDecisions = (taskRows: TaskRow[]) => taskRows.flatMap((task) => [
  ...(task.firstDecision ? [{ taskId: task.id, step: task.stepId, decision: task.firstDecision.outcome, by: task.firstDecision.byEmail, reason: task.firstDecision.reason ?? null, at: task.firstDecision.at, stage: 'first_approval' }] : []),
  ...(task.decision ? [{ taskId: task.id, step: task.stepId, decision: task.decision, by: task.decidedByEmail, reason: task.decisionReason, at: task.decidedAt, stage: 'final' }] : []),
]);

/**
 * Cases: creation from any trigger (form, event, API, assisted, manual), listing with case scope, details, timeline
 * and evidence export. Scope: `cases:read_all` sees everything; `cases:read` sees cases it started or that have a
 * task assigned to, decided by, or queued for one of the caller's roles.
 */
@Injectable({ scope: Scope.REQUEST })
export class CasesService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User | null,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  actor(): AuditActor {
    return { type: this.user?.kind ?? 'system', id: this.user?.userId, email: this.user?.email };
  }

  /** Create a case on the active version of a workflow and (unless draft) start its execution. */
  async start(input: StartCaseInput): Promise<CaseRow> {
    const version = await this.repository.activeVersion(this.tenant.id, input.workflowId);
    if (!version) throw new ConflictError('This workflow has no published version');
    const applicantLabel = input.applicant?.name || input.applicant?.email || 'no applicant';
    const title = renderCaseTitle(version.yaml, input.data, applicantLabel, interpolate);

    const kase = await this.repository.createCase(this.tenant.id, {
      title,
      workflowId: input.workflowId,
      workflowVersion: version.version,
      status: input.draft ? 'draft' : 'submitted',
      applicantId: input.applicant?.id ?? null,
      applicantEmail: input.applicant?.email ?? null,
      applicantName: input.applicant?.name ?? null,
      initiatedByType: input.initiatedBy.type,
      initiatedById: input.initiatedBy.id ?? null,
      initiatedByEmail: input.initiatedBy.email ?? null,
      source: input.source,
      data: input.data,
      clientVisibility: parseDefinition(version.yaml).clientVisibility,
    });
    await this.audit.record(this.tenant.id, input.initiatedBy, input.draft ? 'case.drafted' : 'case.created', { type: 'case', id: kase.id, reference: kase.reference }, { source: input.source, workflowVersion: version.version }, kase.id);
    if (!input.draft) await this.engine.start(this.tenant.id, kase.id);
    return kase;
  }

  /**
   * Assisted application: a member prepares an application for a client. It waits (`pending_client`) until the client
   * reviews and confirms it in their portal (and gives consent); only then does the workflow start.
   */
  async startAssisted(input: { workflowId: string; applicant: { id: string; email: string; name?: string | null }; data: Record<string, unknown> }) {
    const version = await this.repository.activeVersion(this.tenant.id, input.workflowId);
    if (!version) throw new ConflictError('This workflow has no published version');
    const definition = parseDefinition(version.yaml);
    if (definition.startOn.length) throw new BadRequestError('This workflow starts on events, not by hand');
    const actor = this.actor();
    const data = { fullName: input.applicant.name ?? undefined, email: input.applicant.email, ...input.data };
    const kase = await this.repository.createCase(this.tenant.id, {
      title: renderCaseTitle(version.yaml, data, input.applicant.name || input.applicant.email, interpolate),
      workflowId: input.workflowId,
      workflowVersion: version.version,
      status: 'pending_client',
      applicantId: input.applicant.id,
      applicantEmail: input.applicant.email,
      applicantName: input.applicant.name ?? null,
      initiatedByType: actor.type,
      initiatedById: actor.id ?? null,
      initiatedByEmail: actor.email ?? null,
      source: 'assisted',
      data,
      clientVisibility: definition.clientVisibility,
    });
    await this.repository.createTask(this.tenant.id, {
      id: randomUUID(), caseId: kase.id, stepId: 'confirmation', audience: 'client', kind: 'confirmation',
      title: 'Review and confirm your application',
      description: `${actor.email ?? 'Your adviser'} prepared this application with you. Check the details and confirm to submit it.`,
      status: 'open', assigneeId: input.applicant.id,
    });
    await this.audit.record(this.tenant.id, actor, 'case.created', { type: 'case', id: kase.id, reference: kase.reference }, { source: 'assisted', workflowVersion: version.version, awaiting: 'client_confirmation' }, kase.id);
    await this.notifier.send(this.tenant, input.applicant.email, `Please review and confirm your application ${kase.reference}`,
      [`${actor.email ?? 'Your adviser'} prepared an application for you: ${kase.title}.`, 'Please check the details and confirm it so we can start processing it.'],
      { label: 'Review and confirm', url: `${this.notifier.portalUrl(this.tenant, kase.id)}?case=${kase.id}` });
    return kase;
  }

  /** Send the applicant the link to their application again (support, relationship managers). */
  async resendLink(caseId: string) {
    const kase = await this.get(caseId);
    const [row] = await this.db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!row.applicantEmail) throw new BadRequestError('This case has no applicant');
    if (row.clientVisibility !== 'full') throw new NotFoundError('Case not found');
    await this.notifier.send(this.tenant, row.applicantEmail, `Your application ${row.reference}`,
      [`Here is the link to your application "${row.title}". Sign in with your e-mail address to see where it stands.`],
      { label: 'Open your application', url: `${this.notifier.portalUrl(this.tenant, row.id)}?case=${row.id}` });
    await this.audit.record(this.tenant.id, this.actor(), 'case.link_resent', { type: 'case', id: caseId }, { to: row.applicantEmail }, caseId);
    return { sent: true, reference: kase.reference };
  }

  /** Submit a draft case (applicant confirmed their e-mail) and start its execution. */
  async submitDraft(caseId: string, actor: AuditActor) {
    const kase = await this.repository.getCase(this.tenant.id, caseId);
    if (!kase) throw new NotFoundError('Case not found');
    if (kase.status !== 'draft') return kase;
    const updated = await this.repository.updateCase(this.tenant.id, caseId, { status: 'submitted' });
    await this.audit.record(this.tenant.id, actor, 'case.submitted', { type: 'case', id: caseId }, {}, caseId);
    await this.engine.start(this.tenant.id, caseId);
    return updated;
  }

  private hidden: Promise<string[]> | null = null;

  /** Workflows whose `access.cases` rule excludes the caller (docs/plans/15 §5.3), once per request. */
  hiddenWorkflows() {
    if (!this.user) return Promise.resolve([] as string[]);
    return (this.hidden ??= hiddenWorkflowIds(this.db, subjectOf(this.user)));
  }

  /**
   * SQL condition: cases the current member may see — case scope, narrowed by the access rules of sensitive
   * workflows (which apply to `cases:read_all` holders too).
   */
  async scope(): Promise<SQL | undefined> {
    const hidden = await this.hiddenWorkflows();
    const base = this.baseScope();
    return hidden.length ? and(base ?? sql`true`, notInArray(cases.workflowId, hidden)) : base;
  }

  /**
   * Who may start this workflow by hand or by API: its `access.start` rule, or `cases:create` when it has none.
   * 403 (or 404 for a workflow the caller may not even see) otherwise.
   */
  async assertCanStart(workflowId: string) {
    if (!this.user) throw new ForbiddenError();
    if (!(await allows(await startRuleOf(this.db, workflowId), subjectOf(this.user)))) {
      throw new ForbiddenError('You may not start this workflow');
    }
  }

  private baseScope(): SQL | undefined {
    const user = this.user;
    if (!user) return sql`false`;
    if (user.permissions.includes('cases:read_all')) return undefined;
    const roles = user.userTenants[0]?.roleNames ?? [];
    // Support: any client-facing application, never investigations.
    const lookup = user.permissions.includes('cases:lookup')
      ? and(eq(cases.clientVisibility, 'full'), sql`${cases.applicantId} is not null`)
      : undefined;
    const taskMatch = exists(this.db.select({ one: sql`1` }).from(tasks).where(and(
      eq(tasks.caseId, cases.id),
      or(eq(tasks.assigneeId, user.userId), eq(tasks.decidedById, user.userId), roles.length ? inArray(tasks.queueRole, roles) : sql`false`),
    )));
    // Whoever raised an event (e.g. flagged a client) does not get to follow the investigation it opened: need-to-know.
    // Cases an institution's system started with its own events (`event:api:*`) stay visible to it.
    return or(and(eq(cases.initiatedById, user.userId), sql`(${cases.source} not like 'event:%' or ${cases.source} like 'event:api:%')`), taskMatch, lookup);
  }

  async list(filter: { status?: string; workflowId?: string; applicantId?: string; search?: string } = {}) {
    const conditions: (SQL | undefined)[] = [await this.scope()];
    if (filter.status) conditions.push(inArray(cases.status, filter.status.split(',') as any));
    if (filter.workflowId) conditions.push(eq(cases.workflowId, filter.workflowId));
    if (filter.applicantId) conditions.push(eq(cases.applicantId, filter.applicantId));
    if (filter.search) conditions.push(sql`(${cases.reference} ilike ${'%' + filter.search + '%'} or ${cases.title} ilike ${'%' + filter.search + '%'} or ${cases.applicantEmail} ilike ${'%' + filter.search + '%'})`);
    const rows = await this.db.select({ kase: cases, workflowName: sysWorkflows.name }).from(cases)
      .leftJoin(sysWorkflows, eq(sysWorkflows.id, cases.workflowId))
      .where(and(...conditions)).orderBy(desc(cases.createdAt)).limit(500);
    return rows.map(({ kase, workflowName }) => this.summary(kase, workflowName));
  }

  /** Workflows whose active version declares stages: the columns of the pipeline board. */
  async pipelines() {
    const rows = await this.db.select({ workflowId: workflowVersions.workflowId, yaml: workflowVersions.yaml, name: sysWorkflows.name }).from(workflowVersions)
      .innerJoin(sysWorkflows, eq(sysWorkflows.id, workflowVersions.workflowId))
      .where(eq(workflowVersions.status, 'active'));
    // Busiest first (the board opens on it): cases in the member's scope per workflow.
    const counts = await this.db.select({ workflowId: cases.workflowId, count: sql<number>`count(*)::int` }).from(cases).where(await this.scope()).groupBy(cases.workflowId);
    const countOf = (id: string) => counts.find((c) => c.workflowId === id)?.count ?? 0;
    const hidden = await this.hiddenWorkflows();
    return rows.filter((row) => !hidden.includes(row.workflowId)).map((row) => ({ id: row.workflowId, name: row.name, stages: parseDefinition(row.yaml).stages, cases: countOf(row.workflowId) }))
      .filter((p) => p.stages.length > 0).sort((a, b) => b.cases - a.cases || a.name.localeCompare(b.name));
  }

  private summary(kase: CaseRow, workflowName?: string | null) {
    return {
      id: kase.id,
      reference: kase.reference,
      title: kase.title,
      status: kase.status,
      /** Business stage set by the workflow (`case.update`), e.g. underwriting, funding. */
      stage: kase.stage,
      outcome: kase.outcome,
      riskLevel: kase.riskLevel,
      flags: kase.flags,
      workflow: { id: kase.workflowId, version: kase.workflowVersion, name: workflowName ?? null },
      applicant: kase.applicantEmail || kase.applicantName ? { id: kase.applicantId, email: kase.applicantEmail, name: kase.applicantName } : null,
      initiatedBy: { type: kase.initiatedByType, id: kase.initiatedById, email: kase.initiatedByEmail },
      source: kase.source,
      createdAt: kase.createdAt,
      updatedAt: kase.updatedAt,
      completedAt: kase.completedAt,
      consents: kase.consents,
    };
  }

  /** 404 unless the caller may see the case (cheap check for sub-resources). */
  async assertVisible(caseId: string) {
    const [row] = await this.db.select({ id: cases.id }).from(cases).where(and(eq(cases.id, caseId), await this.scope())).limit(1);
    if (!row) throw new NotFoundError('Case not found');
  }

  /** A case the caller may see (404 otherwise, so existence is not revealed). */
  async get(caseId: string) {
    const [row] = await this.db.select({ kase: cases, workflowName: sysWorkflows.name }).from(cases)
      .leftJoin(sysWorkflows, eq(sysWorkflows.id, cases.workflowId))
      .where(and(eq(cases.id, caseId), await this.scope())).limit(1);
    if (!row) throw new NotFoundError('Case not found');
    const taskRows = await this.repository.tasksOfCase(this.tenant.id, caseId);
    const emails = await this.emailsOf(taskRows.map((t) => t.assigneeId).filter(Boolean) as string[]);
    const version = await this.repository.version(this.tenant.id, row.kase.workflowId, row.kase.workflowVersion);
    return {
      ...this.summary(row.kase, row.workflowName),
      // The workflow's stages (labels for the stage bar), in order.
      stages: version ? parseDefinition(version.yaml).stages : [],
      data: row.kase.data,
      calculations: await calculationsOf(this.repository, this.tenant.id, row.kase),
      tasks: taskRows.map((t) => toTaskSummary(t, emails)),
      decisions: caseDecisions(taskRows),
      // Results connectors wrote on the case (verifications, signature requests, messages).
      records: (await this.db.select().from(caseRecords).where(eq(caseRecords.caseId, caseId)).orderBy(desc(caseRecords.createdAt)))
        .map((r) => ({ id: r.id, type: r.type, connectorId: r.connectorId, status: r.status, summary: r.summary, data: r.data, history: r.history, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      // Related parties (co-applicants, guarantors, UBOs) with their progress.
      parties: await PartiesService.forCase(this.repository, this.tenant.id, caseId),
      // Files that passed intake (scanned, sanitised), with where they came from.
      files: (await this.db.select().from(caseFiles).where(eq(caseFiles.caseId, caseId)).orderBy(desc(caseFiles.createdAt)))
        .map((f) => ({ id: f.id, name: f.name, size: f.size, contentType: f.contentType, kind: f.kind, source: f.source, taskId: f.taskId, itemKey: f.itemKey, createdAt: f.createdAt, sanitization: f.report?.sanitization?.actions ?? [], scan: f.report?.scan?.result ?? null })),
    };
  }

  async timeline(caseId: string) {
    await this.assertVisible(caseId);
    return this.audit.list(this.tenant.id, { caseId, order: 'asc' });
  }

  /** Evidence pack: the case, its tasks and decisions and the full timeline (audited). */
  async export(caseId: string) {
    const kase = await this.get(caseId);
    const timeline = await this.audit.list(this.tenant.id, { caseId, order: 'asc' });
    await this.audit.record(this.tenant.id, this.actor(), 'case.exported', { type: 'case', id: caseId }, {}, caseId);
    return { exportedAt: new Date().toISOString(), exportedBy: this.user?.email, case: kase, timeline };
  }

  async emailsOf(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, [...new Set(ids)]));
    return new Map(rows.map((r) => [r.id, r.email]));
  }
}

export { toTaskSummary };
