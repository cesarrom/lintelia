import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { caseParties, cases, tasks } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY, ENGINE_CLIENT, EngineClient } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { isFinalStatus } from '../engine/case-repository';
import { NOTIFIER } from '../engine/providers';
import type { Notifier } from '../engine/notifier';
import { IdentityService } from '../auth/identity.service';
import { redis } from '../clients/redis.client';
import { OneTimeSecrets } from '../auth/session.store';
import { tenantWebUrl } from '../constants';
import { AuditWriter } from './audit.writer';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';

const INVITATION_TTL_SECONDS = 14 * 24 * 3600;
const ROLE_LABELS: Record<string, string> = { co_applicant: 'co-applicant', guarantor: 'guarantor', ubo: 'beneficial owner', director: 'director', signatory: 'signatory' };

export const presentParty = (p: typeof caseParties.$inferSelect) => ({
  id: p.id, role: p.role, name: p.name, email: p.email, status: p.status, share: p.share,
  verification: (p.data?.verification as string | undefined) ?? null, childCaseId: p.childCaseId, createdAt: p.createdAt,
});

/**
 * Related parties of a case (docs/plans/06): the applicant invites co-applicants, guarantors, directors or beneficial
 * owners; each joins through their own single-use link and only ever sees their own part.
 */
@Injectable({ scope: Scope.REQUEST })
export class PartiesService {
  private readonly secrets = new OneTimeSecrets(redis());

  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  /** Only the applicant manages the parties of their application. */
  private async ownCase(caseId: string) {
    const [kase] = await this.db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.applicantId, this.user.userId))).limit(1);
    if (!kase) throw new NotFoundError('Case not found');
    return kase;
  }

  async list(caseId: string) {
    await this.ownCase(caseId);
    return (await this.repository.partiesOfCase(this.tenant.id, caseId)).map(presentParty);
  }

  async invite(caseId: string, input: { role?: string; email?: string; name?: string; share?: number }) {
    const kase = await this.ownCase(caseId);
    if (isFinalStatus(kase.status)) throw new ConflictError('This application is closed');
    const role = String(input.role ?? '').trim();
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(role)) throw new BadRequestError('A role is required (e.g. co_applicant, guarantor, ubo)');
    const email = String(input.email ?? '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestError('A valid e-mail address is required');
    if (email.toLowerCase() === kase.applicantEmail?.toLowerCase()) throw new BadRequestError('You are already the applicant');
    const person = await this.identity.ensureClient(this.tenant, email, input.name);
    const [party] = await this.db.insert(caseParties).values({
      caseId, personId: person.id, role, name: input.name?.trim() || null, email, share: Number.isFinite(input.share) ? Math.round(Number(input.share)) : null,
      invitedBy: this.user.email,
    }).onConflictDoNothing().returning();
    if (!party) throw new ConflictError('This person already has this role on the application');
    const token = randomBytes(32).toString('base64url');
    await this.secrets.put('party-invitation', token, { tenantId: this.tenant.id, partyId: party.id }, INVITATION_TTL_SECONDS);
    const inviter = kase.applicantName || kase.applicantEmail || 'An applicant';
    await this.notifier.send(this.tenant, email, `${inviter} added you to an application`, [
      `${inviter} added you as ${ROLE_LABELS[role] ?? role.replace(/_/g, ' ')} to an application with ${this.tenant.name}.`,
      'Open the link to take part. You will only see what concerns you.',
    ], { label: 'Join the application', url: tenantWebUrl(this.tenant.domain, `/join?party=${token}`) });
    await this.audit.record(this.tenant.id, { type: 'client', id: this.user.userId, email: this.user.email }, 'party.invited', { type: 'party', id: party.id, role }, {}, caseId);
    return presentParty(party);
  }

  /** The applicant confirms the list: the `parties.collect` step continues (minimums per role are checked). */
  async complete(caseId: string) {
    await this.ownCase(caseId);
    const [task] = await this.db.select().from(tasks).where(and(eq(tasks.caseId, caseId), eq(tasks.kind, 'parties'), eq(tasks.status, 'open'), eq(tasks.assigneeId, this.user.userId))).limit(1);
    if (!task) throw new ConflictError('Nothing to confirm on this application');
    const spec = (task.requestItems?.[0] ?? {}) as { roles?: string[]; minimum?: Record<string, number> };
    const parties = (await this.repository.partiesOfCase(this.tenant.id, caseId)).filter((p) => p.status !== 'removed');
    for (const [role, minimum] of Object.entries(spec.minimum ?? {})) {
      const count = parties.filter((p) => p.role === role).length;
      if (count < minimum) throw new BadRequestError(`Add at least ${minimum} ${ROLE_LABELS[role] ?? role}`);
    }
    await this.repository.updateTask(this.tenant.id, task.id, { status: 'completed', response: { parties: parties.map((p) => p.id) } });
    await this.audit.record(this.tenant.id, { type: 'client', id: this.user.userId, email: this.user.email }, 'client_request.answered', { type: 'task', id: task.id }, { parties: parties.length }, caseId);
    await this.engine.signal(this.tenant.id, caseId, task.id, { outcome: 'completed', by: { id: this.user.userId, email: this.user.email, type: 'client' } });
    return parties.map(presentParty);
  }

  /** Parties of a case for the institution's team. */
  static async forCase(repository: CaseRepository, tenantId: string, caseId: string) {
    return (await repository.partiesOfCase(tenantId, caseId)).map(presentParty);
  }
}

/**
 * Accepting a party invitation (public: the link is the credential, single use). The person is signed in as a client
 * (their account is created when they were invited); a sub-workflow waiting for them continues.
 */
export async function acceptPartyInvitation(deps: { repository: CaseRepository; engine: EngineClient; identity: IdentityService; audit: AuditWriter; secrets: OneTimeSecrets }, tenant: Tenant, token: string) {
  const entry = await deps.secrets.take<{ tenantId: string; partyId: string }>('party-invitation', token ?? '');
  if (!entry || entry.tenantId !== tenant.id) throw new NotFoundError('This invitation is invalid or has expired');
  const party = await deps.repository.getParty(tenant.id, entry.partyId);
  if (!party || party.status === 'removed') throw new NotFoundError('This invitation is invalid or has expired');
  if (party.status === 'invited') await deps.repository.updateParty(tenant.id, party.id, { status: 'in_progress' });
  await deps.audit.record(tenant.id, { type: 'client', id: party.personId, email: party.email }, 'party.joined', { type: 'party', id: party.id, role: party.role }, {}, party.caseId);
  if (party.childCaseId) {
    await deps.engine.resolve(tenant.id, party.childCaseId, `party:${party.id}:joined`, { outcome: 'joined', by: { id: party.personId, email: party.email, type: 'client' } }).catch((error) => console.error('party join signal failed', error));
  }
  return { session: await deps.identity.sessionForClient(tenant, party.personId), caseId: party.caseId, role: party.role };
}

