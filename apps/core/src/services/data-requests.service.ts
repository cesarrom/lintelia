import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { cases, dataRequests, FINAL_CASE_STATUSES, tasks, users } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { NOTIFIER } from '../engine/providers';
import type { Notifier } from '../engine/notifier';
import { IdentityService } from '../auth/identity.service';
import { AuditWriter } from './audit.writer';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';

type DataRequestRow = typeof dataRequests.$inferSelect;

const present = (row: DataRequestRow) => ({
  id: row.id,
  type: row.type,
  status: row.status,
  resolution: row.resolution,
  requestedAt: row.requestedAt,
  completedAt: row.completedAt,
  hasExport: row.type === 'export' && row.status === 'completed' && !!row.result,
});

/**
 * Clients' data-rights requests. Clients file them in their portal; compliance (`data_requests:manage`) completes
 * them: an export gathers everything the client may see about themselves; an erasure anonymises the client profile,
 * unless records must be retained (open applications, or any investigation — AML record keeping), in which case the
 * request is rejected with the reason.
 */
@Injectable({ scope: Scope.REQUEST })
export class DataRequestsService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  // --- clients -----------------------------------------------------------------------------------------------------

  async file(type: string) {
    if (type !== 'export' && type !== 'erasure') throw new BadRequestError('type must be export or erasure');
    const [open] = await this.db.select().from(dataRequests)
      .where(and(eq(dataRequests.clientId, this.user.userId), eq(dataRequests.type, type), eq(dataRequests.status, 'open')));
    if (open) return present(open);
    const [row] = await this.db.insert(dataRequests).values({ clientId: this.user.userId, type }).returning();
    await this.audit.record(this.tenant.id, this.actor, 'data_request.created', { type: 'data_request', id: row.id }, { requestType: type });
    return present(row);
  }

  async mine() {
    const rows = await this.db.select().from(dataRequests).where(eq(dataRequests.clientId, this.user.userId)).orderBy(desc(dataRequests.requestedAt));
    return rows.map(present);
  }

  async myExport(requestId: string) {
    const [row] = await this.db.select().from(dataRequests).where(and(eq(dataRequests.id, requestId), eq(dataRequests.clientId, this.user.userId)));
    if (!row || row.type !== 'export' || row.status !== 'completed' || !row.result) throw new NotFoundError('Export not available');
    return row.result;
  }

  // --- compliance --------------------------------------------------------------------------------------------------

  async list(status?: string) {
    const rows = await this.db.select({ request: dataRequests, client: { id: users.id, email: users.email, name: users.name } })
      .from(dataRequests).innerJoin(users, eq(users.id, dataRequests.clientId))
      .where(status ? eq(dataRequests.status, status as DataRequestRow['status']) : undefined)
      .orderBy(desc(dataRequests.requestedAt));
    return rows.map(({ request, client }) => ({ ...present(request), client, completedBy: request.completedByEmail }));
  }

  /** Everything the client may see about themselves: profile, applications (not investigations), requests, consents. */
  private async exportFor(clientId: string) {
    const [client] = await this.db.select().from(users).where(eq(users.id, clientId));
    const own = await this.db.select().from(cases).where(and(eq(cases.applicantId, clientId), eq(cases.clientVisibility, 'full')));
    const requests = await this.db.select().from(tasks).where(and(eq(tasks.audience, 'client'), eq(tasks.assigneeId, clientId)));
    const visibleCaseIds = new Set(own.map((c) => c.id));
    return {
      generatedAt: new Date().toISOString(),
      institution: this.tenant.name,
      profile: { email: client.email, name: client.name, createdAt: client.createdAt },
      applications: own.map((c) => ({ reference: c.reference, title: c.title, status: c.status, submittedAt: c.createdAt, answers: c.data, consents: c.consents })),
      requests: requests.filter((t) => visibleCaseIds.has(t.caseId) || t.kind === 'information_request')
        .map((t) => ({ title: t.title, question: t.description, answer: t.response, status: t.status, at: t.createdAt })),
    };
  }

  async complete(requestId: string) {
    const [row] = await this.db.select().from(dataRequests).where(eq(dataRequests.id, requestId));
    if (!row) throw new NotFoundError('Request not found');
    if (row.status !== 'open') throw new ConflictError(`This request is already ${row.status}`);
    const [client] = await this.db.select().from(users).where(eq(users.id, row.clientId));
    const now = new Date();

    if (row.type === 'export') {
      const result = await this.exportFor(row.clientId);
      await this.db.update(dataRequests).set({ status: 'completed', result, completedAt: now, completedByEmail: this.user.email }).where(eq(dataRequests.id, requestId));
      await this.notifier.send(this.tenant, client.email, 'Your data export is ready', ['The copy of your data you asked for is ready to download from your portal.'],
        { label: 'Open your portal', url: this.notifier.portalUrl(this.tenant) });
    } else {
      // Kept: any investigation about the client, or an application that is still being processed.
      const theirCases = await this.db.select({ status: cases.status, visibility: cases.clientVisibility }).from(cases).where(eq(cases.applicantId, row.clientId));
      const openApplications = theirCases.filter((c) => c.visibility === 'full' && !FINAL_CASE_STATUSES.includes(c.status));
      const underRetention = theirCases.some((c) => c.visibility !== 'full') || openApplications.length > 0;
      if (underRetention) {
        // The client is not told why beyond a neutral statement (no tipping-off about investigations).
        const resolution = 'Some of your records must be kept for legal reasons; they will be deleted when the retention period ends.';
        await this.db.update(dataRequests).set({ status: 'rejected', resolution, completedAt: now, completedByEmail: this.user.email }).where(eq(dataRequests.id, requestId));
        await this.audit.record(this.tenant.id, this.actor, 'data_request.rejected', { type: 'data_request', id: requestId }, { reason: openApplications.length ? 'open_applications' : 'retention' });
        await this.notifier.send(this.tenant, client.email, 'About your erasure request', [resolution]);
        return { ...present({ ...row, status: 'rejected', resolution, completedAt: now }) };
      }
      await this.notifier.send(this.tenant, client.email, 'Your data was erased', ['As you asked, we erased your personal data. You will not receive further e-mails from us.']);
      await this.db.update(dataRequests).set({ status: 'completed', completedAt: now, completedByEmail: this.user.email }).where(eq(dataRequests.id, requestId));
      await this.identity.revokeUserSessions('client', this.tenant.id, row.clientId).catch(() => undefined);
      await this.db.update(users).set({ email: `erased+${row.clientId}@invalid`, name: 'Erased client', status: 'disabled', passwordHash: null } as any).where(eq(users.id, row.clientId));
      await this.db.update(cases).set({ applicantEmail: null, applicantName: 'Erased client', data: {} }).where(eq(cases.applicantId, row.clientId));
    }
    await this.audit.record(this.tenant.id, this.actor, 'data_request.completed', { type: 'data_request', id: requestId }, { requestType: row.type });
    const [updated] = await this.db.select().from(dataRequests).where(eq(dataRequests.id, requestId));
    return present(updated);
  }
}
