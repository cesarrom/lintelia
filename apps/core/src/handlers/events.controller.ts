import { Controller, Inject, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { Require } from '../auth/access';
import { EventsService } from '../services/events.service';
import { IdentityService } from '../auth/identity.service';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { redis } from '../clients/redis.client';
import { BadRequestError } from '../http/errors';
import { handle } from '../http/respond';

/**
 * Events from the institution's own systems (docs/plans/04 §Inbound): `POST /events` with `{ id, type, data,
 * applicantEmail? }` starts every published workflow whose `startOn` lists `api:<type>`. Types are namespaced so an
 * external system can never impersonate a platform event (e.g. `client.flagged`). Deduplicated by `id` for 7 days.
 */
@Controller({ path: '/events', scope: Scope.REQUEST })
export class EventsHandler {
  constructor(
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('cases:create')
  @Post()
  publish(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{ id?: string; type?: string; data?: Record<string, unknown>; applicantEmail?: string; applicantName?: string }>();
      if (!body?.type || !/^[a-z0-9][a-z0-9_.-]{0,63}$/i.test(body.type)) throw new BadRequestError('type is required (letters, digits, . _ -)');
      if (body.id) {
        const fresh = await redis().send('SET', [`api-event:${this.tenant.id}:${body.id}`, '1', 'EX', String(7 * 24 * 3600), 'NX']);
        if (!fresh) return { duplicate: true, started: [] };
      }
      const email = body.applicantEmail?.includes('@') ? body.applicantEmail : null;
      const client = email ? await this.identity.ensureClient(this.tenant, email, body.applicantName) : null;
      const started = await this.events.emit(`api:${body.type}`, { ...(body.data ?? {}), ...(email ? { email } : {}) },
        { type: this.user.kind, id: this.user.userId, email: this.user.email },
        client ? { id: client.id, email: client.email, name: body.applicantName ?? client.name } : undefined);
      return { duplicate: false, event: `api:${body.type}`, started: started.map((c) => ({ id: c.id, reference: c.reference })) };
    }, 'Failed to publish the event', 202);
  }
}
