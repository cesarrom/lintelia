import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { cases, users } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { AuditWriter } from './audit.writer';
import { CasesService } from './cases.service';
import { EventsService } from './events.service';
import { BadRequestError, NotFoundError } from '../http/errors';

export const FLAG_CATEGORIES = ['unusual_transactions', 'structuring', 'sanctions_concern', 'fraud_suspicion', 'adverse_media', 'other'] as const;

/** The institution's clients (end users): directory, profile with cases, and suspicious-activity flags. */
@Injectable({ scope: Scope.REQUEST })
export class ClientsService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  async list(search?: string) {
    const rows = await this.db.select({
      id: users.id, email: users.email, name: users.name, status: users.status, createdAt: users.createdAt,
      cases: sql<number>`(select count(*)::int from ${cases} where ${cases.applicantId} = ${users.id} and ${cases.status} <> 'draft')`,
    }).from(users)
      .where(and(eq(users.kind, 'client'), search ? sql`(${users.email} ilike ${'%' + search + '%'} or ${users.name} ilike ${'%' + search + '%'})` : undefined))
      .orderBy(asc(users.email)).limit(500);
    return rows;
  }

  async get(clientId: string) {
    const [client] = await this.db.select().from(users).where(and(eq(users.id, clientId), eq(users.kind, 'client')));
    if (!client) throw new NotFoundError('Client not found');
    const clientCases = await this.cases.list({ applicantId: clientId });
    return { id: client.id, email: client.email, name: client.name, status: client.status, createdAt: client.createdAt, cases: clientCases };
  }

  /** Flag a client for suspicious activity: audited, and starts the workflows subscribed to `client.flagged`. */
  async flag(clientId: string, input: { reason?: string; category?: string }) {
    const [client] = await this.db.select().from(users).where(and(eq(users.id, clientId), eq(users.kind, 'client')));
    if (!client) throw new NotFoundError('Client not found');
    const reason = input.reason?.trim();
    if (!reason) throw new BadRequestError('Describe why the client is flagged');
    const category = FLAG_CATEGORIES.includes(input.category as any) ? input.category! : 'other';
    const actor = { type: this.user.kind, id: this.user.userId, email: this.user.email };
    await this.audit.record(this.tenant.id, actor, 'client.flagged', { type: 'user', id: clientId, email: client.email }, { reason, category });
    const started = await this.events.emit('client.flagged', {
      clientId, clientName: client.name || client.email, clientEmail: client.email, reason, category, flaggedBy: this.user.email,
    }, actor, { id: client.id, email: client.email, name: client.name || client.email });
    // The flagger learns that an investigation was opened, not its reference (need-to-know).
    return { flagged: true, investigationsOpened: started.length };
  }
}
