import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { users } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { CasesService } from '../services/cases.service';
import { parseTopic } from './topics';

/**
 * Who may listen to what (docs/plans/17 §4.3, LIVE-04), decided when the stream opens (and again at each reconnection):
 *  - a client: their own topics; a case of theirs their workflow shows them (`clientVisibility: full`);
 *  - a member: their own tasks and messages, the queues of their roles, cases they may see (case scope and the
 *    workflow's rules — or they started it), clients' data with `clients:read`, every case change with `cases:read`;
 *  - an API client: cases with `cases:read`, clients' data with `clients:read`.
 * Listening never shows data: the screen fetches it through the endpoints that check the same rights.
 */
@Injectable({ scope: Scope.REQUEST })
export class LiveAccess {
  private caseChecks = new Map<string, Promise<boolean>>();

  constructor(
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(CasesService) private readonly cases: CasesService,
  ) { }

  private can(permission: string) {
    return this.user.permissions.includes(permission);
  }

  private roles() {
    return this.user.userTenants?.[0]?.roleNames ?? [];
  }

  private async clientExists(id: string) {
    const [row] = await this.repository.db(this.tenant.id).select({ id: users.id }).from(users).where(and(eq(users.id, id), eq(users.kind, 'client'))).limit(1);
    return !!row;
  }

  private canSeeCase(caseId: string) {
    let check = this.caseChecks.get(caseId);
    if (!check) {
      check = (async () => {
        const kase = await this.repository.getCase(this.tenant.id, caseId);
        if (!kase) return false;
        if (this.user.kind === 'client') return kase.applicantId === this.user.userId && kase.clientVisibility === 'full';
        if (this.user.kind === 'member' && kase.initiatedById === this.user.userId) return true;
        if (!this.can('cases:read')) return false;
        return this.cases.assertVisible(caseId).then(() => true, () => false);
      })();
      this.caseChecks.set(caseId, check);
    }
    return check;
  }

  async allowed(topic: string): Promise<boolean> {
    const parsed = parseTopic(topic);
    if (!parsed) return false;
    const me = this.user.userId.toLowerCase();
    const kind = this.user.kind;
    switch (parsed.kind) {
      case 'client':
        if (kind === 'client') return parsed.id === me;
        if (parsed.part === 'messages' || parsed.part === 'notifications') return false;
        return (kind === 'member' || kind === 'api_client') && this.can('clients:read') && this.clientExists(parsed.id);
      case 'case':
        return this.canSeeCase(parsed.id);
      case 'member':
        return kind === 'member' && parsed.id === me;
      case 'queue':
        return kind === 'member' && this.roles().includes(parsed.role);
      case 'cases':
        return kind === 'member' && this.can('cases:read');
    }
  }

  async check(topics: string[]) {
    const allowed: string[] = [];
    const denied: string[] = [];
    for (const topic of topics) ((await this.allowed(topic)) ? allowed : denied).push(topic);
    return { allowed, denied };
  }
}
