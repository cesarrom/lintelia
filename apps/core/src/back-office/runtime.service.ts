import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { backOfficePageSources, widgetsSources, type BackOfficeDefinition, type Tenant, type User } from '@repo/lintelia/schemas';
import { cases, clientRecords, tasks, tenantSecurityPolicies, users } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY, ENGINE_CLIENT, type EngineClient } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { isFinalStatus } from '../engine/case-repository';
import { interpolate } from '../engine/expressions';
import type { ScreenDefinition } from '../engine/components/client-app';
import { AuditWriter } from '../services/audit.writer';
import { CasesService } from '../services/cases.service';
import { TasksService } from '../services/tasks.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { listRecords, loadMe } from '../client-apps/profiles';
import { checkScreenAnswers } from '../client-apps/screen-answers';
import { allows, subjectOf } from '../access/rules';
import { activeBackOffice, pruneBackOffice } from './store';
import { LiveHub } from '../live/hub';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BackOfficeContext { client?: string; case?: string }

/**
 * The back office at work (docs/plans/16): the published definition pruned for the member, the data its pages read —
 * resolved here under the member's permissions, case scope and workflow rules, only what the page declares — the
 * actions (the action's rule, then the workflow's own start rule) and the staff screens they open.
 */
@Injectable({ scope: Scope.REQUEST })
export class BackOfficeRuntimeService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(TasksService) private readonly tasks: TasksService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(LiveHub) private readonly live: LiveHub,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  private can(permission: string) {
    return this.user.permissions.includes(permission);
  }

  private pruned: Promise<{ version: number; definition: BackOfficeDefinition } | null> | null = null;

  /** The published back office as this member may see it (null: the institution has none). */
  definition() {
    return (this.pruned ??= (async () => {
      const active = await activeBackOffice(this.db);
      if (!active) return null;
      return { version: active.version, definition: await pruneBackOffice(this.db, active.definition, subjectOf(this.user)) };
    })());
  }

  async app() {
    const active = await this.definition();
    return active ? { available: true, version: active.version, definition: active.definition } : { available: false };
  }

  // --- data ------------------------------------------------------------------------------------------------------------

  /** The client of a context page: must exist and be readable (clients:read). */
  private async contextClient(clientId: string | undefined) {
    if (!clientId || !UUID.test(clientId)) throw new BadRequestError('This page is about a client: say which one');
    if (!this.can('clients:read')) throw new ForbiddenError('Reading clients needs clients:read');
    const [client] = await this.db.select().from(users).where(and(eq(users.id, clientId), eq(users.kind, 'client'))).limit(1);
    if (!client) throw new NotFoundError('Client not found');
    return client;
  }

  private async readAudit(what: Record<string, unknown>, clientId: string) {
    const [policy] = await this.db.select({ readAudit: tenantSecurityPolicies.readAudit }).from(tenantSecurityPolicies).limit(1);
    if (policy?.readAudit) await this.audit.record(this.tenant.id, this.actor, 'client.viewed', { type: 'user', id: clientId }, what);
  }

  private async metrics() {
    const mine = this.can('tasks:work') || this.can('tasks:assign') ? await this.tasks.list('mine') : [];
    const queue = this.can('tasks:work') || this.can('tasks:assign') ? await this.tasks.list('queue') : [];
    const visible = this.can('cases:read') ? await this.cases.list({}) : [];
    const open = visible.filter((c) => !isFinalStatus(c.status));
    const count = <T>(items: T[], by: (item: T) => string | null | undefined) => items.reduce<Record<string, number>>((acc, item) => {
      const k = by(item) ?? 'none';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    return {
      tasks: { mine: mine.length, queue: queue.length, overdue: [...mine, ...queue].filter((t) => t.dueAt && new Date(t.dueAt) < new Date()).length },
      cases: { open: open.length, total: visible.length, byStatus: count(visible, (c) => c.status), byWorkflow: count(open, (c) => c.workflow.name), byStage: count(open, (c) => c.stage) },
    };
  }

  /** What a page (or the dashboard's additions) reads, for this member; sources they may not read are left out. */
  async data(body: { page?: string; slot?: string; context?: BackOfficeContext }) {
    const active = await this.definition();
    if (!active) throw new NotFoundError('This institution has no back-office screens yet');
    let sources: string[];
    let pageContext: 'none' | 'client' | 'case' = 'none';
    if (body?.slot === 'dashboard') sources = widgetsSources(active.definition.slots.dashboard);
    else {
      const page = body?.page ? active.definition.pages[body.page] : undefined;
      if (!page) throw new NotFoundError('Page not found');
      sources = backOfficePageSources(page);
      pageContext = page.context;
    }
    const context = body?.context ?? {};
    const data: Record<string, unknown> = {};
    const records: Record<string, unknown[]> = {};
    const client = pageContext === 'client' ? await this.contextClient(context.client) : null;
    const kase = pageContext === 'case' ? await this.cases.get(String(context.case ?? '')) : null;
    for (const source of sources) {
      if (source === 'member') {
        data.member = { id: this.user.userId, email: this.user.email, name: this.user.name, roles: this.user.userTenants[0]?.roleNames ?? [], attributes: this.user.attributes ?? {} };
      } else if (source === 'cases') {
        if (this.can('cases:read')) data.cases = (await this.cases.list(client ? { applicantId: client.id } : {})).map((c) => ({ ...c, workflowName: c.workflow.name }));
      } else if (source === 'tasks') {
        if (this.can('tasks:work') || this.can('tasks:assign')) {
          const mine = (await this.tasks.list('mine')).map((t) => ({ ...t, view: 'mine' }));
          const queue = (await this.tasks.list('queue')).map((t) => ({ ...t, view: 'queue' }));
          data.tasks = [...mine, ...queue.filter((q) => !mine.some((m) => m.id === q.id))];
        }
      } else if (source === 'metrics') {
        data.metrics = await this.metrics();
      } else if (source === 'client' && client) {
        const me = await loadMe(this.db, client.id);
        data.client = { ...(me ?? {}), id: client.id, email: client.email, name: client.name, status: client.status, createdAt: client.createdAt };
      } else if (source === 'case' && kase) {
        data.case = kase;
      } else if (source.startsWith('records:') && this.can('clients:read')) {
        const collection = source.slice('records:'.length);
        if (client) records[collection] = await listRecords(this.db, client.id, collection);
        else if (pageContext === 'case' && kase?.applicant?.id) records[collection] = await listRecords(this.db, kase.applicant.id, collection);
        else {
          // Across clients (most recent first, bounded), each record with its client.
          const rows = await this.db.select({ record: clientRecords, email: users.email, name: users.name }).from(clientRecords)
            .innerJoin(users, and(eq(users.id, clientRecords.clientId), eq(users.tenantId, clientRecords.tenantId)))
            .where(eq(clientRecords.collection, collection)).orderBy(desc(clientRecords.updatedAt)).limit(500);
          records[collection] = rows.map(({ record, email, name }) => ({ ...(record.data as Record<string, unknown>), key: record.key, clientId: record.clientId, clientEmail: email, clientName: name, updatedAt: record.updatedAt }));
        }
      }
    }
    data.records = records;
    if (client) await this.readAudit({ page: body.page ?? body.slot }, client.id);
    return data;
  }

  // --- actions and staff screens ----------------------------------------------------------------------------------------

  /**
   * Run an action: its rule (with the page's client or case as context) and the workflow's start rule; inputs from the
   * context by the action's templates, and from the button for the keys the action allows. The member's first screen
   * (a `team.screen` for them) comes back when the workflow reaches it within a few seconds.
   */
  async runAction(key: string, body: { context?: BackOfficeContext; input?: Record<string, unknown> }) {
    const active = await this.definition();
    const action = active?.definition.actions[key];
    if (!action) throw new NotFoundError('Action not found');
    const context = body?.context ?? {};
    const client = action.context === 'client' ? await this.contextClient(context.client) : null;
    const kase = action.context === 'case' ? await this.cases.get(String(context.case ?? '')) : null;
    const scope = {
      member: { id: this.user.userId, email: this.user.email, name: this.user.name, attributes: this.user.attributes ?? {} },
      ...(client ? { client: { id: client.id, email: client.email, name: client.name } } : {}),
      ...(kase ? { case: kase } : {}),
    };
    if (!(await allows(action.access, subjectOf(this.user), scope))) throw new ForbiddenError('You may not run this action');
    await this.cases.assertCanStart(action.workflowId);
    const input: Record<string, unknown> = {};
    for (const [name, template] of Object.entries(action.input)) input[name] = interpolate(template, scope as Record<string, unknown>);
    for (const name of action.inputs) {
      const value = body?.input?.[name];
      if (['string', 'number', 'boolean'].includes(typeof value)) input[name] = typeof value === 'string' ? value.slice(0, 500) : value;
    }
    const applicant = client ? { id: client.id, email: client.email, name: client.name }
      : kase?.applicant ? { id: kase.applicant.id, email: kase.applicant.email, name: kase.applicant.name } : null;
    const started = await this.cases.start({
      workflowId: action.workflowId, data: input, applicant, source: `backoffice:${key}`,
      initiatedBy: { type: 'member', id: this.user.userId, email: this.user.email },
    });
    await this.audit.record(this.tenant.id, this.actor, 'backoffice.action_run', { type: 'case', id: started.id, reference: started.reference }, { action: key, label: action.label, ...(client ? { client: client.id } : {}) }, started.id);
    return this.settle(started.id);
  }

  /** Where a case stands for this member: a screen for them, waiting on others, working, or done. */
  async progress(caseId: string) {
    const [kase] = await this.db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!kase) throw new NotFoundError('Case not found');
    // The member who started it follows it; others need to see the case.
    if (kase.initiatedById !== this.user.userId) await this.cases.assertVisible(caseId);
    const rows = await this.db.select().from(tasks).where(eq(tasks.caseId, caseId));
    const open = rows.filter((t) => t.audience === 'member' && ['open', 'claimed', 'escalated', 'pending_second_approval'].includes(t.status));
    const screen = open.find((t) => t.kind === 'screen' && t.assigneeId === this.user.userId);
    const others = open.filter((t) => t !== screen);
    const final = isFinalStatus(kase.status);
    const state = screen ? 'screen' : final ? 'done' : others.length ? 'waiting' : 'working';
    return {
      case: { id: kase.id, reference: kase.reference, title: kase.title, status: kase.status, outcome: kase.outcome, final },
      state,
      screen: screen ? { taskId: screen.id, ...(screen.screen as unknown as ScreenDefinition) } : null,
      waitingFor: others.map((t) => ({ title: t.title, queue: t.queueRole, status: t.status })),
      live: { topics: [`case/${kase.id}`, `case/${kase.id}/channel/*`] },
    };
  }

  /**
   * The staff screens waiting for this member (theirs to send): what they started and left half-way, or what a
   * workflow handed to them by name. Members without tasks:work have no task list, so this is how they get back to it.
   */
  async myScreens() {
    const rows = await this.db.select({ task: tasks, reference: cases.reference, caseTitle: cases.title }).from(tasks)
      .innerJoin(cases, and(eq(cases.id, tasks.caseId), eq(cases.tenantId, tasks.tenantId)))
      .where(and(eq(tasks.kind, 'screen'), eq(tasks.audience, 'member'), eq(tasks.assigneeId, this.user.userId), inArray(tasks.status, ['open', 'claimed', 'escalated'])))
      .orderBy(desc(tasks.createdAt)).limit(50);
    return rows.map(({ task, reference, caseTitle }) => ({
      taskId: task.id, title: (task.screen as unknown as ScreenDefinition | null)?.title ?? task.title, createdAt: task.createdAt,
      case: { id: task.caseId, reference, title: caseTitle },
    }));
  }

  private async settle(caseId: string, answeredTaskId?: string) {
    const deadline = Date.now() + 5000;
    let state = await this.progress(caseId);
    while (Date.now() < deadline && (state.state === 'working' || (answeredTaskId && state.screen?.taskId === answeredTaskId))) {
      await this.live.next(this.tenant.id, `case/${caseId}`, 400);
      state = await this.progress(caseId);
    }
    return state;
  }

  /**
   * Send a staff screen (`team.screen`): the member it is for, or someone of its queue (who then takes it). The answers
   * are checked as for clients; the button is the workflow's next event.
   */
  async submitScreen(taskId: string, body: { event?: string; values?: Record<string, unknown> }) {
    const task = await this.repository.getTask(this.tenant.id, taskId);
    if (!task || task.audience !== 'member' || task.kind !== 'screen') throw new NotFoundError('Screen not found');
    if (!['open', 'claimed', 'escalated'].includes(task.status)) throw new ConflictError('This screen was already sent');
    if (task.assigneeId && task.assigneeId !== this.user.userId) throw new ForbiddenError('This screen is for someone else');
    if (!task.assigneeId) {
      if (!task.queueRole || !(this.user.userTenants[0]?.roleNames ?? []).includes(task.queueRole)) throw new ForbiddenError('This screen is not in your queues');
      // Hidden cases (workflow rules) stay hidden.
      await this.cases.assertVisible(task.caseId).catch(() => { throw new NotFoundError('Screen not found'); });
    }
    const screen = task.screen as unknown as ScreenDefinition;
    const button = screen.buttons.find((b) => b.key === body?.event);
    if (!button) throw new BadRequestError('Unknown button');
    const values = await checkScreenAnswers(this.db, screen, button, body?.values ?? {}, { taskId: task.id, uploaderId: this.user.userId });
    const [updated] = await this.db.update(tasks).set({
      status: 'completed', assigneeId: this.user.userId, response: { ...values, button: button.key }, decision: button.key,
      decidedById: this.user.userId, decidedByEmail: this.user.email, decidedAt: new Date(),
    }).where(and(eq(tasks.id, taskId), inArray(tasks.status, ['open', 'claimed', 'escalated']))).returning();
    if (!updated) throw new ConflictError('This screen was already sent');
    await this.audit.record(this.tenant.id, this.actor, 'task.screen_submitted', { type: 'task', id: taskId, title: screen.title }, { button: button.key, fields: Object.keys(values) }, task.caseId);
    await this.engine.signal(this.tenant.id, task.caseId, taskId, { outcome: button.key, response: values, by: { id: this.user.userId, email: this.user.email, type: 'member' } });
    return this.settle(task.caseId, taskId);
  }
}

