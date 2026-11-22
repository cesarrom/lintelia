import { Inject, Injectable, Scope } from '@nestjs/common';
import type { Tenant } from '@repo/lintelia/schemas';
import { TENANT } from '../injector/tokens/tenant.token';
import type { AuditActor } from './audit.writer';
import { EventRouter } from './event-router';

/**
 * Platform events (e.g. `client.flagged`, `client.registered`): routed like every other event (docs/plans/17 §3.4) —
 * to the cases waiting for them, then starting the workflows that subscribe to them (`startOn`).
 */
@Injectable({ scope: Scope.REQUEST })
export class EventsService {
  constructor(
    @Inject(EventRouter) private readonly router: EventRouter,
    @Inject(TENANT) private readonly tenant: Tenant,
  ) { }

  async emit(event: string, payload: Record<string, unknown>, actor: AuditActor, applicant?: { id?: string | null; email?: string | null; name?: string | null }) {
    const routed = await this.router.route(this.tenant.id, { type: event, data: payload, source: 'platform', applicant: applicant ?? null, actor });
    return routed.started;
  }
}
