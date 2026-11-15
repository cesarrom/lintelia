import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { roles, supportGrants, tenants, userRoles, users } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { USER } from '../injector/tokens/user.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { TenantDirectory } from './tenant-directory.service';
import { AuditWriter } from './audit.writer';
import { PlatformAuditWriter } from './platform-audit.writer';
import { NOTIFIER } from '../engine/providers';
import type { Notifier } from '../engine/notifier';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';
import { tenantWebUrl } from '../constants';

const MAX_MINUTES = 8 * 60;
type GrantRow = typeof supportGrants.$inferSelect;

const present = (g: GrantRow) => ({
  id: g.id, staffEmail: g.staffEmail, reason: g.reason, scope: g.scope, durationMinutes: g.durationMinutes,
  status: g.status === 'active' && g.expiresAt && g.expiresAt < new Date() ? 'expired' : g.status,
  requestedAt: g.requestedAt, decidedAt: g.decidedAt, decidedBy: g.decidedByEmail, expiresAt: g.expiresAt, revokedAt: g.revokedAt,
});

/**
 * Support access (STAFF-05 / FIA-11): staff request time-bound read-only access to one institution; the institution
 * approves, denies or revokes it. Grants live on the platform connection; every step is written to both the platform
 * and the institution's audit trail.
 */
@Injectable({ scope: Scope.REQUEST })
export class SupportAccessService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(PlatformAuditWriter) private readonly platformAudit: PlatformAuditWriter,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(USER) private readonly user: User,
    @Inject(TENANT) private readonly tenant: Tenant | null,
  ) { }

  private get db() {
    return this.databases.platform;
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  // --- staff --------------------------------------------------------------------------------------------------------

  async request(input: { tenant?: string; reason?: string; scope?: string; durationMinutes?: number }) {
    const tenant = await this.directory.findByKey(input.tenant);
    if (!tenant || tenant.status !== 'active') throw new NotFoundError('Institution not found');
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestError('Give the reason (e.g. the ticket)');
    if ((input.scope ?? 'read') !== 'read') throw new BadRequestError('Only read-only access can be requested');
    const minutes = Number(input.durationMinutes ?? 60);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > MAX_MINUTES) throw new BadRequestError(`Duration must be between 5 and ${MAX_MINUTES} minutes`);
    const [grant] = await this.db.insert(supportGrants).values({
      tenantId: tenant.id, staffId: this.user.userId, staffEmail: this.user.email, reason, scope: 'read', durationMinutes: minutes,
    }).returning();
    await this.platformAudit.record(this.actor, 'support_access.requested', { type: 'support_grant', id: grant.id }, tenant, { reason, durationMinutes: minutes });
    await this.audit.record(tenant.id, this.actor, 'support_access.requested', { type: 'support_grant', id: grant.id }, { reason, durationMinutes: minutes });
    // Tell the institution's administrators, who approve or deny it.
    const admins = await this.databases.forTenant(tenant.id).select({ email: users.email }).from(users)
      .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.tenantId, users.tenantId)))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(and(eq(roles.key, 'admin'), eq(users.status, 'active')));
    for (const admin of admins) {
      await this.notifier.send(tenant, admin.email, 'Fintivio support asks for read-only access',
        [`${this.user.email} (Fintivio support) asks for read-only access to your workspace for ${minutes} minutes.`, `Reason: ${reason}`, 'Nothing happens unless you approve it; you can revoke it at any time.'],
        { label: 'Review the request', url: tenantWebUrl(tenant.domain, '/app/support-access') }).catch(() => undefined);
    }
    return present(grant);
  }

  async mine() {
    const rows = await this.db.select({ grant: supportGrants, tenant: tenants.domain }).from(supportGrants)
      .innerJoin(tenants, eq(tenants.id, supportGrants.tenantId))
      .where(eq(supportGrants.staffId, this.user.userId)).orderBy(desc(supportGrants.requestedAt)).limit(200);
    return rows.map(({ grant, tenant }) => ({ ...present(grant), tenant }));
  }

  // --- institution ------------------------------------------------------------------------------------------------

  async list() {
    const tenant = this.tenant!;
    await this.db.update(supportGrants).set({ status: 'expired' })
      .where(and(eq(supportGrants.tenantId, tenant.id), eq(supportGrants.status, 'active'), lt(supportGrants.expiresAt, new Date())));
    const rows = await this.db.select().from(supportGrants).where(eq(supportGrants.tenantId, tenant.id)).orderBy(desc(supportGrants.requestedAt)).limit(200);
    return rows.map(present);
  }

  private async load(grantId: string) {
    const [grant] = await this.db.select().from(supportGrants).where(and(eq(supportGrants.id, grantId), eq(supportGrants.tenantId, this.tenant!.id)));
    if (!grant) throw new NotFoundError('Request not found');
    return grant;
  }

  async decide(grantId: string, decision: 'approve' | 'deny') {
    const grant = await this.load(grantId);
    if (grant.status !== 'pending') throw new ConflictError(`This request is ${grant.status}`);
    const now = new Date();
    const changes = decision === 'approve'
      ? { status: 'active' as const, decidedAt: now, decidedByEmail: this.user.email, expiresAt: new Date(now.getTime() + grant.durationMinutes * 60_000) }
      : { status: 'denied' as const, decidedAt: now, decidedByEmail: this.user.email };
    const [updated] = await this.db.update(supportGrants).set(changes).where(eq(supportGrants.id, grantId)).returning();
    const action = decision === 'approve' ? 'support_access.granted' : 'support_access.denied';
    await this.audit.record(this.tenant!.id, this.actor, action, { type: 'support_grant', id: grantId }, { staff: grant.staffEmail, expiresAt: updated.expiresAt });
    await this.platformAudit.record(this.actor, action, { type: 'support_grant', id: grantId }, this.tenant, { staff: grant.staffEmail });
    return present(updated);
  }

  async revoke(grantId: string) {
    const grant = await this.load(grantId);
    if (grant.status !== 'active' && grant.status !== 'pending') throw new ConflictError(`This request is ${grant.status}`);
    const [updated] = await this.db.update(supportGrants).set({ status: 'revoked', revokedAt: new Date() }).where(eq(supportGrants.id, grantId)).returning();
    await this.audit.record(this.tenant!.id, this.actor, 'support_access.revoked', { type: 'support_grant', id: grantId }, { staff: grant.staffEmail });
    await this.platformAudit.record(this.actor, 'support_access.revoked', { type: 'support_grant', id: grantId }, this.tenant, { staff: grant.staffEmail });
    return present(updated);
  }
}
