import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne, notInArray, or, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { caseFiles, caseParties, cases, sysForms, tasks, users } from '../entities';
import { hiddenWorkflowIds, subjectOf } from '../access/rules';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from '../engine/engine.client';
import { calculationsOf, type CaseRepository, type TaskRow } from '../engine/case-repository';
import { NOTIFIER } from '../engine/providers';
import type { Notifier } from '../engine/notifier';
import { AuditWriter } from './audit.writer';
import { toTaskSummary } from './cases.service';
import { parseDefinition } from '../engine/definition';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';

const OPEN_STATUSES = ['open', 'claimed', 'escalated', 'pending_second_approval', 'pending_client'] as const;
const ACTIONABLE = ['open', 'claimed', 'escalated', 'pending_second_approval'];

export interface DecisionInput {
  outcome?: string;
  /** Alias of `outcome` (approve | reject | request_info | custom outcome key). */
  decision?: string;
  reason?: string;
  items?: Array<{ key: string; label: string; type?: 'text' | 'file' }>;
}

/**
 * Human tasks (docs/architecture/cases-and-workflows.md). Members see tasks queued for their roles, claim them and
 * decide within their authority; the rules enforced here:
 *  - segregation of duties: whoever started a case cannot decide its tasks;
 *  - authority: `high` tasks need `cases:approve_high_risk`;
 *  - four-eyes: positive outcomes of `high` tasks need a second, different approver;
 *  - outcomes that require a reason are refused without one;
 *  - `request_info` asks the applicant and parks the task until they answer.
 * Final decisions are signalled to the waiting workflow step.
 */
@Injectable({ scope: Scope.REQUEST })
export class TasksService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get roles() {
    return this.user.userTenants[0]?.roleNames ?? [];
  }

  private hidden: Promise<string[]> | null = null;

  /** Tasks of workflows whose cases the member may not see are not theirs to see either (docs/plans/15 §5.3). */
  private hiddenWorkflows() {
    return (this.hidden ??= hiddenWorkflowIds(this.db, subjectOf(this.user)));
  }

  private can(permission: string) {
    return this.user.permissions.includes(permission);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  /** mine: assigned to me · queue: unassigned in my roles' queues · all: every open task (tasks:assign). */
  async list(view: 'mine' | 'queue' | 'all' = 'mine') {
    const member = eq(tasks.audience, 'member');
    let condition: SQL | undefined;
    if (view === 'mine') {
      condition = and(member, eq(tasks.assigneeId, this.user.userId), inArray(tasks.status, [...OPEN_STATUSES]));
    } else if (view === 'queue') {
      const roles = this.roles.length ? this.roles : ['__none__'];
      // My roles' queues, plus second approvals (four-eyes) for anyone holding high-risk authority except the first approver.
      condition = and(member, isNull(tasks.assigneeId), or(
        and(inArray(tasks.queueRole, roles), inArray(tasks.status, ['open', 'escalated'])),
        // High-authority work is also open to everyone who may decide it.
        this.can('cases:approve_high_risk') ? and(eq(tasks.authority, 'high'), inArray(tasks.status, ['open', 'escalated'])) : sql`false`,
        this.can('cases:approve_high_risk')
          ? and(eq(tasks.status, 'pending_second_approval'), sql`coalesce(${tasks.firstDecision}->>'by', '') <> ${this.user.userId}`)
          : sql`false`,
      ));
    } else {
      if (!this.can('tasks:assign')) throw new ForbiddenError('Seeing all tasks needs tasks:assign');
      condition = and(member, inArray(tasks.status, [...OPEN_STATUSES]));
    }
    const hidden = await this.hiddenWorkflows();
    const rows = await this.db.select({ task: tasks, kase: cases }).from(tasks)
      .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
      .where(and(condition, hidden.length ? notInArray(cases.workflowId, hidden) : undefined)).orderBy(asc(tasks.dueAt), asc(tasks.createdAt)).limit(500);
    const emails = await this.emailsOf(rows.map((r) => r.task.assigneeId).filter(Boolean) as string[]);
    return rows.map(({ task, kase }) => this.present(task, kase, emails));
  }

  private present(task: TaskRow, kase: typeof cases.$inferSelect, emails: Map<string, string>) {
    return {
      ...toTaskSummary(task, emails),
      case: { id: kase.id, reference: kase.reference, title: kase.title, status: kase.status, applicantEmail: kase.applicantEmail, applicantName: kase.applicantName, riskLevel: kase.riskLevel },
    };
  }

  private async emailsOf(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, [...new Set(ids)]));
    return new Map(rows.map((r) => [r.id, r.email]));
  }

  /** Visible when assigned to me, queued for one of my roles, decided by me, or with tasks:assign / cases:read_all. */
  private inMyQueues(task: TaskRow) {
    if (task.status === 'pending_second_approval') return this.can('cases:approve_high_risk');
    if (task.authority === 'high' && this.can('cases:approve_high_risk')) return true;
    return !!task.queueRole && this.roles.includes(task.queueRole);
  }

  private visible(task: TaskRow) {
    return task.audience === 'member' && (
      task.assigneeId === this.user.userId ||
      this.inMyQueues(task) ||
      task.decidedById === this.user.userId ||
      this.can('tasks:assign') || this.can('cases:read_all'));
  }

  private async load(taskId: string) {
    const [row] = await this.db.select({ task: tasks, kase: cases }).from(tasks)
      .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
      .where(eq(tasks.id, taskId)).limit(1);
    if (!row || !this.visible(row.task) || (await this.hiddenWorkflows()).includes(row.kase.workflowId)) throw new NotFoundError('Task not found');
    return row;
  }

  async get(taskId: string) {
    const { task, kase } = await this.load(taskId);
    const emails = await this.emailsOf([task.assigneeId].filter(Boolean) as string[]);
    // The case's documents (stipulations, signed contracts, answers): what the decision is based on.
    const files = (await this.db.select().from(caseFiles).where(eq(caseFiles.caseId, kase.id)).orderBy(desc(caseFiles.createdAt)))
      .map((f) => ({ id: f.id, name: f.name, size: f.size, contentType: f.contentType, kind: f.kind, source: f.source, taskId: f.taskId, itemKey: f.itemKey, createdAt: f.createdAt, sanitization: f.report?.sanitization?.actions ?? [], scan: f.report?.scan?.result ?? null }));
    return { ...this.present(task, kase, emails), caseData: kase.data, calculations: await calculationsOf(this.repository, this.tenant.id, kase), files };
  }

  async claim(taskId: string) {
    const { task } = await this.load(taskId);
    if (task.assigneeId === this.user.userId) return this.get(taskId);
    if (task.assigneeId) throw new ConflictError('This task is already assigned');
    if (!this.inMyQueues(task)) throw new ForbiddenError('This task is not in your queues');
    if (task.status === 'pending_second_approval' && task.firstDecision?.by === this.user.userId) throw new ForbiddenError('Four-eyes: the second approval must come from a different person');
    if (!['open', 'escalated', 'pending_second_approval'].includes(task.status)) throw new ConflictError(`Task is ${task.status}`);
    const [updated] = await this.db.update(tasks)
      .set({ assigneeId: this.user.userId, status: task.status === 'pending_second_approval' ? 'pending_second_approval' : 'claimed' })
      .where(and(eq(tasks.id, taskId), isNull(tasks.assigneeId))).returning();
    if (!updated) throw new ConflictError('This task is already assigned');
    await this.audit.record(this.tenant.id, this.actor, 'task.claimed', { type: 'task', id: taskId }, {}, task.caseId);
    if (task.routing?.sameAssigneeAs === 'siblings') await this.claimSiblings(task);
    return this.get(taskId);
  }

  /** Sticky routing: the open tasks of the same step in the sibling cases (same parent) go to the same person. */
  private async claimSiblings(task: TaskRow) {
    const [kase] = await this.db.select({ parentCaseId: cases.parentCaseId }).from(cases).where(eq(cases.id, task.caseId)).limit(1);
    if (!kase?.parentCaseId) return;
    const siblings = await this.db.select({ id: tasks.id, caseId: tasks.caseId }).from(tasks)
      .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
      .where(and(eq(cases.parentCaseId, kase.parentCaseId), eq(tasks.stepId, task.stepId), isNull(tasks.assigneeId), eq(tasks.status, 'open'), ne(tasks.id, task.id)));
    for (const sibling of siblings) {
      await this.db.update(tasks).set({ assigneeId: this.user.userId, status: 'claimed' }).where(and(eq(tasks.id, sibling.id), isNull(tasks.assigneeId)));
      await this.audit.record(this.tenant.id, this.actor, 'task.assigned', { type: 'task', id: sibling.id }, { to: this.user.email, reason: 'same assignee for every item' }, sibling.caseId);
    }
  }

  async assign(taskId: string, assigneeId: string) {
    if (!this.can('tasks:assign')) throw new ForbiddenError('Assigning tasks needs tasks:assign');
    const { task } = await this.load(taskId);
    if (!ACTIONABLE.includes(task.status)) throw new ConflictError(`Task is ${task.status}`);
    const [assignee] = await this.db.select().from(users).where(and(eq(users.id, assigneeId), eq(users.kind, 'member'), eq(users.status, 'active')));
    if (!assignee) throw new BadRequestError('Unknown member');
    await this.db.update(tasks).set({ assigneeId, status: task.status === 'pending_second_approval' ? task.status : 'claimed' }).where(eq(tasks.id, taskId));
    await this.audit.record(this.tenant.id, this.actor, 'task.assigned', { type: 'task', id: taskId }, { to: assignee.email }, task.caseId);
    return this.get(taskId);
  }

  async decide(taskId: string, input: DecisionInput) {
    const { task, kase } = await this.load(taskId);
    const outcomeKey = input.outcome ?? input.decision;
    const reason = input.reason?.trim() || undefined;
    if (!ACTIONABLE.includes(task.status)) throw new ConflictError(`Task is ${task.status}`);
    if (!this.can('tasks:work')) throw new ForbiddenError('Deciding tasks needs tasks:work');
    if (task.assigneeId && task.assigneeId !== this.user.userId) throw new ForbiddenError('This task is assigned to someone else');
    if (!task.assigneeId && !this.inMyQueues(task)) throw new ForbiddenError('This task is not in your queues');
    if (kase.initiatedByType === 'member' && kase.initiatedById === this.user.userId) {
      throw new ForbiddenError('Segregation of duties: you started this case, someone else must decide it');
    }
    const outcome = task.outcomes.find((o) => o.key === outcomeKey);
    if (!outcome) throw new BadRequestError(`Unknown outcome "${outcomeKey}"; expected one of ${task.outcomes.map((o) => o.key).join(', ')}`);
    if (outcome.requiresReason && !reason) throw new BadRequestError('A reason is required for this decision');
    if (task.authority === 'high' && !this.can('cases:approve_high_risk')) {
      throw new ForbiddenError('This decision is above your authority (needs cases:approve_high_risk)');
    }

    if (outcome.key === 'request_info') return this.requestInformation(task, kase, reason!, input.items);

    const now = new Date();
    if (task.authority === 'high' && outcome.needsSecondApproval) {
      if (!task.firstDecision) {
        await this.db.update(tasks).set({
          status: 'pending_second_approval', assigneeId: null,
          firstDecision: { outcome: outcome.key, by: this.user.userId, byEmail: this.user.email, reason, at: now.toISOString() },
        }).where(eq(tasks.id, taskId));
        await this.audit.record(this.tenant.id, this.actor, 'task.first_approval', { type: 'task', id: taskId }, { outcome: outcome.key, reason }, task.caseId);
        return { ...(await this.get(taskId)), status: 'pending_second_approval' };
      }
      if (task.firstDecision.by === this.user.userId) throw new ForbiddenError('Four-eyes: the second approval must come from a different person');
    }

    await this.db.update(tasks).set({
      status: 'completed', assigneeId: task.assigneeId ?? this.user.userId, decision: outcome.key, decisionReason: reason ?? null,
      decidedById: this.user.userId, decidedByEmail: this.user.email, decidedAt: now,
    }).where(eq(tasks.id, taskId));
    await this.audit.record(this.tenant.id, this.actor, 'task.decided', { type: 'task', id: taskId, title: task.title }, { outcome: outcome.key, reason, secondApproval: !!task.firstDecision }, task.caseId);
    await this.engine.signal(this.tenant.id, task.caseId, taskId, {
      outcome: outcome.key, reason, by: { id: this.user.userId, email: this.user.email, type: 'member' },
    });
    return { ...(await this.get(taskId)), status: 'completed' };
  }

  /** Ask the applicant for more information; the task waits (pending_client) until they answer in the portal. */
  private async requestInformation(task: TaskRow, kase: typeof cases.$inferSelect, reason: string, items?: DecisionInput['items']) {
    if (!kase.applicantId) throw new BadRequestError('This case has no applicant to ask');
    const requestItems = (items?.length ? items : [{ key: 'information', label: reason, type: 'text' as const }])
      .map((item) => ({ key: String(item.key), label: String(item.label), type: item.type === 'file' ? 'file' as const : 'text' as const }));
    const requestId = randomUUID();
    await this.db.insert(tasks).values({
      id: requestId, caseId: kase.id, stepId: task.stepId, audience: 'client', kind: 'information_request',
      title: 'More information needed', description: reason, status: 'open', assigneeId: kase.applicantId,
      requestItems, parentTaskId: task.id,
    });
    await this.db.update(tasks).set({ status: 'pending_client', assigneeId: task.assigneeId ?? this.user.userId }).where(eq(tasks.id, task.id));
    await this.repository.updateCase(this.tenant.id, kase.id, { status: 'pending_client' });
    await this.audit.record(this.tenant.id, this.actor, 'task.information_requested', { type: 'task', id: task.id }, { reason, items: requestItems.map((i) => i.key) }, kase.id);
    if (kase.applicantEmail) {
      const link = this.notifier.requestLink(this.tenant, kase);
      await this.notifier.send(this.tenant, kase.applicantEmail, link.subject, [reason], { label: link.label, url: link.url });
    }
    return { ...(await this.get(task.id)), status: 'pending_client' };
  }
}

/** Client side of tasks: requests addressed to the applicant (portal). */
/** What the portal needs to run a connector's client step (only http(s) URLs are passed on). */
export const clientActionView = (action: NonNullable<TaskRow['clientAction']>) => {
  const url = typeof action.url === 'string' && /^https?:\/\//.test(action.url) ? action.url : null;
  return url ? { type: action.type, sdk: action.sdk ?? null, url, title: action.title ?? null, instructions: action.instructions ?? null } : null;
};

@Injectable({ scope: Scope.REQUEST })
export class ClientTasksService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  /** My cases (as applicant), newest first. */
  async myCases() {
    const rows = await this.db.select().from(cases).where(and(eq(cases.applicantId, this.user.userId), ne(cases.status, 'draft'), eq(cases.clientVisibility, 'full'))).orderBy(sql`${cases.createdAt} desc`);
    return rows.map((kase) => ({ id: kase.id, reference: kase.reference, title: kase.title, status: kase.status, createdAt: kase.createdAt, updatedAt: kase.updatedAt }));
  }

  /** Client view of a case: status, progress and the requests waiting for them. Internal details are not exposed. */
  async myCase(caseId: string) {
    const [kase] = await this.db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.applicantId, this.user.userId), eq(cases.clientVisibility, 'full'))).limit(1);
    if (!kase) return this.partyView(caseId);
    const taskRows = await this.repository.tasksOfCase(this.tenant.id, caseId);
    const confirmation = taskRows.find((t) => t.kind === 'confirmation' && t.status === 'open');
    const requests = taskRows.filter((t) => t.audience === 'client' && t.kind !== 'confirmation').map((t) => ({
      id: t.id, kind: t.kind, title: t.title, description: t.description, status: t.status, items: t.requestItems ?? [], dueAt: t.dueAt, answeredAt: t.status === 'completed' ? t.updatedAt : null,
      // Steps run by a connector in the client's browser (identity verification, signature): what to open.
      action: t.status === 'open' && t.clientAction ? clientActionView(t.clientAction) : null,
    }));
    // Clients see the workflow's step names (e.g. "Credit review"), never task titles, assignees or notes.
    const version = await this.repository.version(this.tenant.id, kase.workflowId, kase.workflowVersion);
    const stepNames = new Map((version ? parseDefinition(version.yaml).steps : []).map((step) => [step.id, step.name]));
    const steps = taskRows.filter((t) => t.audience === 'member').map((t) => ({
      name: stepNames.get(t.stepId) ?? 'Review',
      status: t.status === 'completed' ? 'done' : t.status === 'pending_client' ? 'waiting_for_you' : 'in_progress',
    }));
    return {
      id: kase.id, reference: kase.reference, title: kase.title, status: kase.status, createdAt: kase.createdAt, updatedAt: kase.updatedAt,
      answers: kase.data, consents: kase.consents, steps, requests,
      confirmation: confirmation ? { id: confirmation.id, title: confirmation.title, description: confirmation.description } : null,
    };
  }

  /**
   * A related party's view of a case (docs/plans/06): their role, the case status and their own requests (in their
   * own sub-case) — never the applicant's details, answers or other parties.
   */
  private async partyView(caseId: string) {
    const [row] = await this.db.select({ party: caseParties, kase: cases }).from(caseParties)
      .innerJoin(cases, and(eq(cases.id, caseParties.caseId), eq(cases.tenantId, caseParties.tenantId)))
      .where(and(eq(caseParties.caseId, caseId), eq(caseParties.personId, this.user.userId), eq(cases.clientVisibility, 'full'))).limit(1);
    if (!row || row.party.status === 'removed') throw new NotFoundError('Case not found');
    const own = row.party.childCaseId ? (await this.repository.tasksOfCase(this.tenant.id, row.party.childCaseId)).filter((t) => t.audience === 'client' && t.assigneeId === this.user.userId) : [];
    return {
      id: row.kase.id, reference: row.kase.reference, title: `Application ${row.kase.reference}`, status: row.kase.status,
      createdAt: row.kase.createdAt, updatedAt: row.kase.updatedAt, myRole: row.party.role, myStatus: row.party.status, steps: [],
      requests: own.map((t) => ({
        id: t.id, title: t.title, description: t.description, status: t.status, items: t.requestItems ?? [], dueAt: t.dueAt,
        answeredAt: t.status === 'completed' ? t.updatedAt : null, action: t.status === 'open' && t.clientAction ? clientActionView(t.clientAction) : null,
      })),
      confirmation: null,
    };
  }

  /**
   * The client confirms an application prepared for them (assisted application) and consents to its processing; the
   * workflow starts now.
   */
  async confirm(caseId: string, input: { consent?: boolean; privacyNotice?: string }) {
    const [kase] = await this.db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.applicantId, this.user.userId))).limit(1);
    if (!kase) throw new NotFoundError('Case not found');
    const task = (await this.repository.tasksOfCase(this.tenant.id, caseId)).find((t) => t.kind === 'confirmation' && t.status === 'open');
    if (!task || kase.status !== 'pending_client') throw new ConflictError('Nothing to confirm on this application');
    if (input.consent !== true) throw new BadRequestError('Please confirm the details and give your consent');
    const acceptedAt = new Date().toISOString();
    const consents = [
      ...kase.consents,
      { document: 'application_confirmation', version: `workflow-v${kase.workflowVersion}`, acceptedAt, channel: 'portal' },
      ...(input.privacyNotice ? [{ document: 'privacy_notice', version: String(input.privacyNotice), acceptedAt, channel: 'portal' }] : []),
    ];
    await this.repository.updateTask(this.tenant.id, task.id, { status: 'completed', response: { confirmed: true, at: acceptedAt } });
    await this.repository.updateCase(this.tenant.id, caseId, { status: 'submitted', consents });
    await this.audit.record(this.tenant.id, { type: 'client', id: this.user.userId, email: this.user.email }, 'case.confirmed_by_client', { type: 'case', id: caseId }, { consents: consents.map((c) => c.document) }, caseId);
    await this.engine.start(this.tenant.id, caseId);
    return this.myCase(caseId);
  }

  /**
   * Everything waiting for me, across cases. Requests of cases hidden from the client (`requests_only`) carry no case
   * reference or title (no tipping-off about investigations).
   */
  async myRequests() {
    const rows = await this.db.select({ task: tasks, kase: cases }).from(tasks)
      .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
      .where(and(eq(tasks.audience, 'client'), eq(tasks.assigneeId, this.user.userId)))
      .orderBy(sql`${tasks.createdAt} desc`);
    return rows.map(({ task, kase }) => ({
      id: task.id,
      kind: task.kind,
      title: task.title,
      description: task.description,
      status: task.status,
      items: task.requestItems ?? [],
      action: task.status === 'open' && task.clientAction ? clientActionView(task.clientAction) : null,
      dueAt: task.dueAt,
      createdAt: task.createdAt,
      answeredAt: task.status === 'completed' ? task.updatedAt : null,
      case: kase.clientVisibility === 'full' ? { id: kase.id, reference: kase.reference, title: kase.title } : null,
    }));
  }

  /** The form a `form.request` step sends (only to the person it is addressed to). */
  async requestForm(taskId: string) {
    const task = await this.repository.getTask(this.tenant.id, taskId);
    if (!task || task.audience !== 'client' || task.assigneeId !== this.user.userId) throw new NotFoundError('Request not found');
    const item = (task.requestItems ?? []).find((i) => i.type === ('form' as never)) as { formId?: string } | undefined;
    if (!item?.formId) throw new NotFoundError('This request has no form');
    const [form] = await this.db.select({ id: sysForms.id, name: sysForms.name, description: sysForms.description, config: sysForms.config }).from(sysForms).where(eq(sysForms.id, item.formId)).limit(1);
    if (!form) throw new NotFoundError('The form was removed');
    return form;
  }

  async respondToRequest(taskId: string, response: Record<string, unknown>) {
    const task = await this.repository.getTask(this.tenant.id, taskId);
    if (!task || task.audience !== 'client' || task.assigneeId !== this.user.userId) throw new NotFoundError('Request not found');
    await this.respond(task.caseId, taskId, response, { quiet: true });
    return (await this.myRequests()).find((r) => r.id === taskId);
  }

  async respond(caseId: string, taskId: string, response: Record<string, unknown>, options: { quiet?: boolean } = {}) {
    const task = await this.repository.getTask(this.tenant.id, taskId);
    if (!task || task.caseId !== caseId || task.audience !== 'client' || task.assigneeId !== this.user.userId) throw new NotFoundError('Request not found');
    if (task.status !== 'open') throw new ConflictError(`This request is ${task.status}`);
    // App screens are answered through the app (per-field validation, buttons): POST /me/app/cases/:id/screens/:task.
    if (task.kind === 'screen') throw new ConflictError('Continue this in the app');
    response = { ...(response ?? {}) };
    const missing = (task.requestItems ?? []).filter((item) => {
      const value = response[item.key];
      if (item.type === 'file') return !(Array.isArray(value) ? value.length : typeof value === 'string' && value.trim());
      if ((item.type as string) === 'form') return !value || typeof value !== 'object';
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (missing.length) throw new BadRequestError(`Missing: ${missing.map((m) => m.label).join(', ')}`);
    // File items carry ids of files that went through intake (scanned, sanitised) for this request and item.
    for (const item of (task.requestItems ?? []).filter((i) => i.type === 'file')) {
      const ids = [response[item.key]].flat().map(String);
      const files = await this.db.select().from(caseFiles).where(and(inArray(caseFiles.id, ids), eq(caseFiles.taskId, task.id), eq(caseFiles.itemKey, item.key), eq(caseFiles.uploadedById, this.user.userId)));
      if (files.length !== new Set(ids).size) throw new BadRequestError(`${item.label}: the files are not ready yet or were refused`);
      response[item.key] = files.map((f) => ({ fileId: f.id, name: f.name, contentType: f.contentType, size: f.size }));
    }

    await this.repository.updateTask(this.tenant.id, taskId, { status: 'completed', response });
    await this.audit.record(this.tenant.id, { type: 'client', id: this.user.userId, email: this.user.email }, 'client_request.answered', { type: 'task', id: taskId }, { items: Object.keys(response) }, caseId);

    if (task.parentTaskId) {
      // Information asked by a reviewer: the review goes back to them.
      const parent = await this.repository.getTask(this.tenant.id, task.parentTaskId);
      if (parent && parent.status === 'pending_client') {
        await this.repository.updateTask(this.tenant.id, parent.id, { status: parent.assigneeId ? 'claimed' : 'open', response: { ...(parent.response ?? {}), [taskId]: response } });
        await this.repository.updateCase(this.tenant.id, caseId, { status: 'in_review' });
      }
    } else {
      await this.engine.signal(this.tenant.id, caseId, taskId, { outcome: 'completed', response, by: { id: this.user.userId, email: this.user.email, type: 'client' } });
    }
    return options.quiet ? null : this.myCase(caseId);
  }
}
