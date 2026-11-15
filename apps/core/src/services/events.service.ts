import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, arrayContains, eq } from 'drizzle-orm';
import type { Tenant } from '@repo/fintivio/schemas';
import { workflowVersions } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { CasesService } from './cases.service';
import type { AuditActor } from './audit.writer';

/** Platform events (e.g. `client.flagged`) start every published workflow that subscribes to them (`startOn`). */
@Injectable({ scope: Scope.REQUEST })
export class EventsService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(TENANT) private readonly tenant: Tenant,
  ) { }

  async emit(event: string, payload: Record<string, unknown>, actor: AuditActor, applicant?: { id?: string | null; email?: string | null; name?: string | null }) {
    const subscribers = await this.repository.db(this.tenant.id).select({ workflowId: workflowVersions.workflowId }).from(workflowVersions)
      .where(and(eq(workflowVersions.status, 'active'), arrayContains(workflowVersions.startOn, [event])));
    const started = [];
    for (const { workflowId } of subscribers) {
      started.push(await this.cases.start({ workflowId, data: payload, applicant, source: `event:${event}`, initiatedBy: actor }));
    }
    return started;
  }
}
