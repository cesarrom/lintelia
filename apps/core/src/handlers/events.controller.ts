import { Controller, Inject, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { Require } from '../auth/access';
import { IdentityService } from '../auth/identity.service';
import { EventRouter } from '../services/event-router';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { BadRequestError } from '../http/errors';
import { handle } from '../http/respond';

const MAX_EVENT = 64_000;

/**
 * Events from the institution's own systems (docs/plans/04 §Inbound, 17 §3): `POST /events` with `{ id, type, data,
 * applicantEmail? }` (`events:publish`). The event (`api:<type>`: namespaced, so a system can never impersonate a
 * platform event) reaches the open cases waiting for it — by their business keys, e.g. the loan it is about — and
 * starts the published workflows whose `startOn` lists it (or hands it to their open case: start-or-deliver).
 * Deduplicated by `id` for 7 days.
 */
@Controller({ path: '/events', scope: Scope.REQUEST })
export class EventsHandler {
  constructor(
    @Inject(EventRouter) private readonly router: EventRouter,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('events:publish')
  @Post()
  publish(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{ id?: string; type?: string; data?: Record<string, unknown>; applicantEmail?: string; applicantName?: string }>();
      if (!body?.type || !/^[a-z0-9][a-z0-9_.-]{0,63}$/i.test(body.type)) throw new BadRequestError('type is required (letters, digits, . _ -)');
      if (body.id !== undefined && (typeof body.id !== 'string' || !body.id || body.id.length > 200)) throw new BadRequestError('id must be a string (your id of the event, at most 200 characters)');
      if (body.data !== undefined && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))) throw new BadRequestError('data must be an object');
      if (JSON.stringify(body.data ?? {}).length > MAX_EVENT) throw new BadRequestError('An event is limited to 64 kB');
      const email = body.applicantEmail?.includes('@') ? body.applicantEmail : null;
      const client = email ? await this.identity.ensureClient(this.tenant, email, body.applicantName) : null;
      const type = `api:${body.type}`;
      const routed = await this.router.route(this.tenant.id, {
        type, data: { ...(body.data ?? {}), ...(email ? { email } : {}) }, source: `${this.user.kind === 'api_client' ? 'api' : this.user.kind}:${this.user.userId}`,
        dedupeKey: body.id ? `api:${body.id}` : null,
        applicant: client ? { id: client.id, email: client.email, name: body.applicantName ?? client.name } : null,
        actor: { type: this.user.kind, id: this.user.userId, email: this.user.email },
      });
      return { duplicate: routed.duplicate, event: type, eventId: routed.eventId, delivered: routed.delivered, started: routed.started };
    }, 'Failed to publish the event', 202);
  }
}
