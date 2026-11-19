import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import { ACCESS_ADMINISTRATION_PERMISSIONS, TENANT_PERMISSION_IDS, resolvePermissions, type Tenant } from '@repo/fintivio/schemas';
import { accessChanges, apiClients, roles, tenantSecurityPolicies, tenants, userRoles, users, type AccessChangeStatus } from '../entities';
import type { Databases, TenantDatabase } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { redis } from '../clients/redis.client';
import { env } from '../constants';
import { AuditWriter } from '../services/audit.writer';
import { TenantDirectory } from '../services/tenant-directory.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { activeCustomKeys, memberAccess, membersHolding } from './catalog';
import { AccessNotifier } from './notify';

/**
 * Change control for access (docs/plans/15 §14, decision 2). Privileged changes — role definitions, role assignments,
 * IdP mappings, workflow access — go through here:
 *
 *  - **notified** to the administrators when they matter (`notify`), always when they wait for someone;
 *  - **effective dates**: `effectiveAt` in the future keeps the change *scheduled* (cancellable) until then;
 *  - **second approver** when the institution's policy is `grants` and the change grants something, or when the kind
 *    demands it (a designer changing who may use a workflow). Revocations never wait for an approval;
 *  - **re-validated** when applied (the requester must still be allowed to make it), audited at every step.
 *
 * Each kind is a handler: `plan` validates the change *as a given actor* (escalation rules included) and describes it;
 * `apply` performs it. An approver must be someone who could have made the change themselves (their own `plan` passes),
 * which also stops approving one's own elevation.
 */
export interface ChangeActor {
  id: string | null;
  email: string | null;
  type: string;
  roles: string[];
  permissions: string[];
}

export interface ChangeContext {
  tenant: Tenant;
  db: TenantDatabase;
  actor: ChangeActor;
}

export interface PlannedChange {
  summary: string;
  diff: Record<string, unknown>;
  /** Adds access (permissions, roles, mappings, a wider rule). */
  grants: boolean;
  /** Worth telling the administrators even when applied at once. */
  notify: boolean;
  /** Needs an approver whatever the policy (e.g. a designer changing a workflow's access). */
  forceApproval?: boolean;
}

export interface ChangeHandler<P = any> {
  /** Who may approve (and reject) this kind. */
  approverPermission: string;
  plan(ctx: ChangeContext, payload: P): Promise<PlannedChange>;
  apply(ctx: ChangeContext, payload: P, meta: { changeId: string; approvedBy: string | null }): Promise<unknown>;
}

export type ChangeRow = typeof accessChanges.$inferSelect;

export interface SubmitResult<T = unknown> {
  status: AccessChangeStatus;
  change: ReturnType<typeof presentChange>;
  result?: T;
}

const PENDING_TTL_MS = 7 * 24 * 3600_000;
const MAX_SCHEDULE_MS = 400 * 24 * 3600_000;

export const presentChange = (row: ChangeRow, viewer?: ChangeActor | null, approverPermission?: string) => ({
  id: row.id, kind: row.kind, summary: row.summary, diff: row.diff, grants: row.grants, status: row.status,
  requestedBy: { id: row.requestedById, email: row.requestedByEmail, type: row.requestedByType },
  effectiveAt: row.effectiveAt, approvedBy: row.approvedByEmail, decidedAt: row.decidedAt, decisionReason: row.decisionReason,
  appliedAt: row.appliedAt, error: row.error, expiresAt: row.expiresAt, createdAt: row.createdAt,
  canApprove: !!viewer && row.status === 'pending_approval' && viewer.id !== row.requestedById && !!approverPermission && viewer.permissions.includes(approverPermission),
  canCancel: !!viewer && ['pending_approval', 'scheduled'].includes(row.status)
    && (viewer.id === row.requestedById || (!!approverPermission && viewer.permissions.includes(approverPermission))),
});

/** A request's principal as a change actor. */
export const actorOf = (user: { userId: string; email: string; kind: string; permissions: string[]; userTenants?: Array<{ roleNames: string[] }> }): ChangeActor => ({
  id: user.userId, email: user.email, type: user.kind, roles: user.userTenants?.[0]?.roleNames ?? [], permissions: user.permissions,
});

export function parseEffectiveAt(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new BadRequestError('effectiveAt must be a date and time (ISO 8601)');
  if (date.getTime() <= Date.now() + 1000) return null;
  if (date.getTime() > Date.now() + MAX_SCHEDULE_MS) throw new BadRequestError('effectiveAt is too far in the future (at most about a year)');
  return date;
}

@Injectable()
export class AccessChanges implements OnModuleInit, OnModuleDestroy {
  private readonly handlers = new Map<string, ChangeHandler>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(AccessNotifier) private readonly notifier: AccessNotifier,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
  ) { }

  register(kind: string, handler: ChangeHandler) {
    this.handlers.set(kind, handler);
  }

  handler(kind: string) {
    const handler = this.handlers.get(kind);
    if (!handler) throw new BadRequestError(`Unknown change kind ${kind}`);
    return handler;
  }

  onModuleInit() {
    if (env.ACCESS_CHANGES_INTERVAL_SECONDS <= 0) return;
    this.timer = setInterval(() => void this.tick().catch((error) => console.error('access changes tick failed', error.message)), env.ACCESS_CHANGES_INTERVAL_SECONDS * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private db(tenantId: string) {
    return this.databases.forTenant(tenantId);
  }

  async policy(tenantId: string) {
    const [row] = await this.db(tenantId).select().from(tenantSecurityPolicies).limit(1);
    return { approval: row?.accessApproval ?? 'off', notify: row?.accessNotify ?? [] };
  }

  /** Submit a change: applied at once, scheduled, or waiting for an approver. */
  async submit<T = unknown>(tenant: Tenant, actor: ChangeActor, kind: string, payload: Record<string, unknown>, options: { effectiveAt?: unknown } = {}): Promise<SubmitResult<T>> {
    const handler = this.handler(kind);
    const db = this.db(tenant.id);
    const ctx: ChangeContext = { tenant, db, actor };
    const plan = await handler.plan(ctx, payload);
    const effectiveAt = parseEffectiveAt(options.effectiveAt);
    const policy = await this.policy(tenant.id);

    let approval = plan.grants && (policy.approval === 'grants' || !!plan.forceApproval);
    let note: string | null = null;
    if (approval) {
      const approvers = (await membersHolding(db, handler.approverPermission)).filter((m) => m.userId !== actor.id);
      if (!approvers.length) {
        if (plan.forceApproval) throw new ConflictError('Nobody else in the institution can approve this change');
        // Approval cannot wait forever when no one else can give it (a soft-lock): apply, and say so.
        approval = false;
        note = 'Applied without a second approver: no other member can approve access changes.';
      }
    }

    const base = {
      kind, summary: plan.summary, payload, diff: plan.diff, grants: plan.grants,
      requestedById: actor.id, requestedByEmail: actor.email, requestedByType: actor.type, effectiveAt, decisionReason: note,
    };

    if (!approval && !effectiveAt) {
      // At once: the change and its log entry.
      const [row] = await db.insert(accessChanges).values({ ...base, status: 'applied', appliedAt: new Date() }).returning();
      const result = await handler.apply(ctx, payload, { changeId: row.id, approvedBy: null }).catch(async (error) => {
        await db.delete(accessChanges).where(eq(accessChanges.id, row.id));
        throw error;
      });
      if (plan.notify || note) await this.tell(tenant, row, 'applied');
      return { status: 'applied', change: presentChange(row, actor, handler.approverPermission), result: result as T };
    }

    const status: AccessChangeStatus = approval ? 'pending_approval' : 'scheduled';
    const [row] = await db.insert(accessChanges).values({ ...base, status, expiresAt: approval ? new Date(Date.now() + PENDING_TTL_MS) : null }).returning();
    await this.audit.record(tenant.id, this.auditActor(actor), approval ? 'access_change.requested' : 'access_change.scheduled',
      { type: 'access_change', id: row.id, kind }, { summary: plan.summary, effectiveAt: effectiveAt?.toISOString() ?? null });
    await this.tell(tenant, row, status);
    return { status, change: presentChange(row, actor, handler.approverPermission) };
  }

  async list(tenant: Tenant, viewer: ChangeActor, filter: { status?: string } = {}) {
    const db = this.db(tenant.id);
    const statuses = filter.status ? filter.status.split(',') as AccessChangeStatus[] : null;
    const rows = await db.select().from(accessChanges).where(statuses ? inArray(accessChanges.status, statuses) : undefined).orderBy(desc(accessChanges.createdAt)).limit(300);
    return rows.map((row) => presentChange(row, viewer, this.handlers.get(row.kind)?.approverPermission));
  }

  async get(tenant: Tenant, viewer: ChangeActor, id: string) {
    const row = await this.row(tenant.id, id);
    return presentChange(row, viewer, this.handlers.get(row.kind)?.approverPermission);
  }

  private async row(tenantId: string, id: string) {
    const [row] = await this.db(tenantId).select().from(accessChanges).where(eq(accessChanges.id, id)).limit(1);
    if (!row) throw new NotFoundError('Change not found');
    return row;
  }

  async approve(tenant: Tenant, approver: ChangeActor, id: string, reason?: string) {
    const row = await this.row(tenant.id, id);
    const handler = this.handler(row.kind);
    if (row.status !== 'pending_approval') throw new ConflictError(`This change is ${row.status.replace('_', ' ')}`);
    if (approver.id && approver.id === row.requestedById) throw new ForbiddenError('You cannot approve your own change: another administrator must');
    if (!approver.permissions.includes(handler.approverPermission)) throw new ForbiddenError(`Approving this change needs ${handler.approverPermission}`);
    // The approver must be someone who could make this change (escalation rules, nobody elevates themselves).
    await handler.plan({ tenant, db: this.db(tenant.id), actor: approver }, row.payload);
    const now = new Date();
    const scheduled = row.effectiveAt && row.effectiveAt > now;
    const [updated] = await this.db(tenant.id).update(accessChanges).set({
      status: scheduled ? 'scheduled' : 'pending_approval', approvedById: approver.id, approvedByEmail: approver.email, decidedAt: now,
      decisionReason: reason?.trim() || null, expiresAt: null,
    }).where(and(eq(accessChanges.id, id), eq(accessChanges.status, 'pending_approval'))).returning();
    if (!updated) throw new ConflictError('This change was decided meanwhile');
    await this.audit.record(tenant.id, this.auditActor(approver), 'access_change.approved', { type: 'access_change', id, kind: row.kind }, { summary: row.summary, requestedBy: row.requestedByEmail, reason: reason?.trim() || null });
    if (scheduled) {
      await this.tell(tenant, updated, 'scheduled');
      return presentChange(updated, approver, handler.approverPermission);
    }
    return presentChange(await this.applyRow(tenant, updated), approver, handler.approverPermission);
  }

  async reject(tenant: Tenant, actor: ChangeActor, id: string, reason?: string) {
    const row = await this.row(tenant.id, id);
    const handler = this.handler(row.kind);
    if (row.status !== 'pending_approval') throw new ConflictError(`This change is ${row.status.replace('_', ' ')}`);
    if (!actor.permissions.includes(handler.approverPermission)) throw new ForbiddenError(`Rejecting this change needs ${handler.approverPermission}`);
    if (!reason?.trim()) throw new BadRequestError('Say why the change is rejected');
    const [updated] = await this.db(tenant.id).update(accessChanges).set({ status: 'rejected', approvedById: actor.id, approvedByEmail: actor.email, decidedAt: new Date(), decisionReason: reason.trim() })
      .where(and(eq(accessChanges.id, id), eq(accessChanges.status, 'pending_approval'))).returning();
    if (!updated) throw new ConflictError('This change was decided meanwhile');
    await this.audit.record(tenant.id, this.auditActor(actor), 'access_change.rejected', { type: 'access_change', id, kind: row.kind }, { summary: row.summary, reason: reason.trim() });
    await this.tell(tenant, updated, 'rejected');
    return presentChange(updated, actor, handler.approverPermission);
  }

  async cancel(tenant: Tenant, actor: ChangeActor, id: string) {
    const row = await this.row(tenant.id, id);
    const handler = this.handler(row.kind);
    if (!['pending_approval', 'scheduled'].includes(row.status)) throw new ConflictError(`This change is ${row.status.replace('_', ' ')}`);
    if (actor.id !== row.requestedById && !actor.permissions.includes(handler.approverPermission)) throw new ForbiddenError('Only the requester or an administrator can cancel this change');
    const [updated] = await this.db(tenant.id).update(accessChanges).set({ status: 'cancelled', decidedAt: new Date() })
      .where(and(eq(accessChanges.id, id), inArray(accessChanges.status, ['pending_approval', 'scheduled']))).returning();
    if (!updated) throw new ConflictError('This change was decided meanwhile');
    await this.audit.record(tenant.id, this.auditActor(actor), 'access_change.cancelled', { type: 'access_change', id, kind: row.kind }, { summary: row.summary });
    await this.tell(tenant, updated, 'cancelled');
    return presentChange(updated, actor, handler.approverPermission);
  }

  /** Apply an approved or due change, re-validated as its requester now. */
  private async applyRow(tenant: Tenant, row: ChangeRow): Promise<ChangeRow> {
    const handler = this.handler(row.kind);
    const db = this.db(tenant.id);
    let status: AccessChangeStatus = 'applied';
    let error: string | null = null;
    try {
      const requester = await this.loadActor(db, row);
      const ctx: ChangeContext = { tenant, db, actor: requester };
      await handler.plan(ctx, row.payload);
      await handler.apply(ctx, row.payload, { changeId: row.id, approvedBy: row.approvedByEmail });
    } catch (e) {
      status = 'failed';
      error = (e as Error).message ?? String(e);
    }
    const [updated] = await db.update(accessChanges).set({ status, error, appliedAt: status === 'applied' ? new Date() : null }).where(eq(accessChanges.id, row.id)).returning();
    await this.audit.record(tenant.id, { type: 'system', email: 'access-changes' }, status === 'applied' ? 'access_change.applied' : 'access_change.failed',
      { type: 'access_change', id: row.id, kind: row.kind }, { summary: row.summary, requestedBy: row.requestedByEmail, approvedBy: row.approvedByEmail, error });
    await this.tell(tenant, updated, status);
    return updated;
  }

  /** The requester as they are now (a change fails if they lost the right to make it meanwhile). */
  private async loadActor(db: TenantDatabase, row: ChangeRow): Promise<ChangeActor> {
    if (row.requestedByType === 'api_client' && row.requestedById) {
      const [client] = await db.select().from(apiClients).where(eq(apiClients.id, row.requestedById)).limit(1);
      if (!client || client.status !== 'active') throw new ForbiddenError('The API client that asked for this change is no longer active');
      return { id: client.id, email: row.requestedByEmail, type: 'api_client', roles: [], permissions: client.permissions };
    }
    if (!row.requestedById) throw new ForbiddenError('Unknown requester');
    const [user] = await db.select().from(users).where(eq(users.id, row.requestedById)).limit(1);
    if (!user || user.status !== 'active') throw new ForbiddenError('The member who asked for this change is no longer active');
    const access = await memberAccess(db, user.id);
    return { id: user.id, email: user.email, type: 'member', roles: access.roleKeys, permissions: access.permissions };
  }

  /** Scheduled changes that are due, and approvals that nobody gave in time. */
  async tick() {
    const lock = await redis().send('SET', ['access-changes:tick', '1', 'EX', '60', 'NX']);
    if (!lock) return;
    try {
      const active = await this.databases.platform.select({ id: tenants.id }).from(tenants).where(eq(tenants.status, 'active'));
      for (const { id } of active) await this.tickTenant(id);
    } finally {
      await redis().del('access-changes:tick');
    }
  }

  async tickTenant(tenantId: string) {
    const db = this.db(tenantId);
    const now = new Date();
    const due = await db.select().from(accessChanges).where(and(eq(accessChanges.status, 'scheduled'), lte(accessChanges.effectiveAt, now)));
    const stale = await db.select().from(accessChanges).where(and(eq(accessChanges.status, 'pending_approval'), lte(accessChanges.expiresAt, now)));
    const ended = await db.select({ userId: userRoles.userId, roleId: userRoles.roleId, email: users.email, role: roles.key, roleName: roles.name, isSystem: roles.isSystem, permissions: roles.permissions })
      .from(userRoles).innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(lte(userRoles.expiresAt, now));
    if (!due.length && !stale.length && !ended.length) return;
    const tenant = await this.directory.findById(tenantId);
    if (!tenant) return;
    // Time-bound roles (docs/plans/15 §5.6): already ignored since their end; removed and recorded here.
    for (const row of ended) {
      await db.delete(userRoles).where(and(eq(userRoles.userId, row.userId), eq(userRoles.roleId, row.roleId), lte(userRoles.expiresAt, now)));
      await this.audit.record(tenantId, { type: 'system', email: 'access-changes' }, 'member.role_expired', { type: 'user', id: row.userId, email: row.email }, { role: row.role });
      const permissions = resolvePermissions([{ key: row.role, isSystem: row.isSystem, permissions: row.permissions }], TENANT_PERMISSION_IDS, undefined, await activeCustomKeys(db));
      if (permissions.some((p) => ACCESS_ADMINISTRATION_PERMISSIONS.includes(p))) {
        await this.notifier.send(tenant, { subject: `Time-bound role ended: ${row.email} (${row.roleName})`, lines: [`The ${row.roleName} role of ${row.email} reached its end date and was removed.`], link: '/app/users' }).catch(() => undefined);
      }
    }
    for (const row of due) await this.applyRow(tenant, row);
    for (const row of stale) {
      const [updated] = await db.update(accessChanges).set({ status: 'expired', decidedAt: now }).where(and(eq(accessChanges.id, row.id), eq(accessChanges.status, 'pending_approval'))).returning();
      if (!updated) continue;
      await this.audit.record(tenantId, { type: 'system', email: 'access-changes' }, 'access_change.expired', { type: 'access_change', id: row.id, kind: row.kind }, { summary: row.summary });
      await this.tell(tenant, updated, 'expired');
    }
  }

  private auditActor(actor: ChangeActor) {
    return { type: actor.type, id: actor.id, email: actor.email };
  }

  private async tell(tenant: Tenant, row: ChangeRow, event: AccessChangeStatus) {
    const by = row.requestedByEmail ?? 'someone';
    const when = row.effectiveAt ? row.effectiveAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : null;
    const messages: Record<string, { subject: string; lines: string[] }> = {
      pending_approval: {
        subject: `Access change waiting for your approval: ${row.summary}`,
        lines: [`${by} asked for this change, which needs a second administrator: ${row.summary}.`, when ? `It would take effect on ${when}.` : 'It takes effect as soon as it is approved.', 'Approve or reject it in Access changes. It expires in 7 days.'],
      },
      scheduled: { subject: `Access change scheduled: ${row.summary}`, lines: [`${row.summary}.`, `Requested by ${by}${row.approvedByEmail ? `, approved by ${row.approvedByEmail}` : ''}. It takes effect on ${when}. It can be cancelled until then.`] },
      applied: { subject: `Access changed: ${row.summary}`, lines: [`${row.summary}.`, `Requested by ${by}${row.approvedByEmail ? `, approved by ${row.approvedByEmail}` : ''}.`, ...(row.decisionReason && !row.approvedByEmail ? [row.decisionReason] : [])] },
      rejected: { subject: `Access change rejected: ${row.summary}`, lines: [`${row.approvedByEmail ?? 'An administrator'} rejected the change ${by} asked for: ${row.summary}.`, `Reason: ${row.decisionReason ?? '—'}`] },
      cancelled: { subject: `Access change cancelled: ${row.summary}`, lines: [`The change ${by} asked for was cancelled: ${row.summary}.`] },
      expired: { subject: `Access change expired: ${row.summary}`, lines: [`Nobody approved the change ${by} asked for within 7 days: ${row.summary}.`] },
      failed: { subject: `Access change failed: ${row.summary}`, lines: [`The change could not be applied: ${row.summary}.`, `Why: ${row.error ?? 'unknown'}`] },
    };
    const message = messages[event];
    if (!message) return;
    await this.notifier.send(tenant, message).catch((error) => console.error('could not send the access change e-mail', error.message));
  }
}
