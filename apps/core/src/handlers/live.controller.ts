import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { Access, Public } from '../auth/access';
import type { AuthContext } from '../auth/auth-context';
import { IdentityService } from '../auth/identity.service';
import { AUTH_CONTEXT } from '../injector/tokens/auth-context.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { redis } from '../clients/redis.client';
import { env } from '../constants';
import { json, jsonError } from '../http/respond';
import { LiveAccess } from '../live/access';
import { LiveHub } from '../live/hub';
import { verifyChannelToken } from '../live/topics';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';

const TICKET_TTL_SECONDS = 60;
const MAX_TOPICS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** When a JWT expires (ms), read from the token already verified by the identity middleware. */
const tokenExpiry = (token: string | null) => {
  try {
    const { exp } = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString());
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
};

export const liveTicketKey = (ticket: string) => `live-ticket:${ticket}`;

/**
 * Live updates over Server-Sent Events (docs/plans/17 §4.5):
 *  - `GET /live?topics=a,b&since=N` — one multiplexed stream; the web app sends its `Authorization` header (fetch);
 *    `EventSource` (which cannot) first gets a single-use ticket: `POST /live/tickets` → `GET /live?ticket=…`.
 *  - `GET /live/cases/:id/channels/:name?tenant&expires&token` — a case channel's capability URL (`case.live.<name>`):
 *    read-only, one channel, until it expires; for screens we do not serve (a kiosk, a partner portal).
 * Events: `ready`, `change` (`{ topic }`: fetch again), `message` (`{ topic, seq, payload }`, with `id:` for
 * `Last-Event-ID`), `expired` (reconnect with fresh credentials), `revoked`; `: ping` comments keep it alive.
 */
@Controller({ path: '/live', scope: Scope.REQUEST })
export class LiveHandler {
  constructor(
    @Inject(LiveHub) private readonly hub: LiveHub,
    @Inject(LiveAccess) private readonly access: LiveAccess,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
  ) { }

  @Access('member', 'client', 'api_client')
  @Get()
  async stream(@Res() ctx: Context) {
    try {
      const topicsParam = ctx.req.query('topics');
      const sinceParam = ctx.req.query('since');
      const topics = [...new Set(String(topicsParam ?? '').split(',').map((t) => t.trim()).filter(Boolean))];
      if (!topics.length) return json(ctx, { error: 'topics is required (comma-separated)' }, 400);
      if (topics.length > MAX_TOPICS) return json(ctx, { error: `At most ${MAX_TOPICS} topics per stream` }, 400);
      const { allowed, denied } = await this.access.check(topics);
      if (denied.length) return json(ctx, { error: 'You may not listen to some of these topics', denied }, 403);
      const since = sinceParam ?? ctx.req.header('last-event-id');
      const token = this.auth.token;
      const tenantKey = this.tenant.domain;
      const userId = this.user.userId;
      ctx.res = this.hub.open({
        tenantId: this.tenant.id, owner: `${this.user.kind}:${userId}`, topics: allowed,
        since: since !== undefined && since !== null && /^\d+$/.test(String(since)) ? Number(since) : null,
        // Topics the screen listens to from the start (replayed whatever `since` says).
        replay: String(ctx.req.query('replay') ?? '').split(',').map((t) => t.trim()).filter((t) => allowed.includes(t)),
        closeAt: tokenExpiry(token),
        // Signed out, deactivated, session revoked: the stream ends.
        revalidate: async () => {
          const again = await this.identity.resolve(new Headers({ authorization: `Bearer ${token}`, 'x-tenant': tenantKey }));
          return again.user?.userId === userId;
        },
      });
    } catch (error) {
      jsonError(ctx, error, 'Failed to open the live stream');
    }
  }

  /** A single-use ticket (60 s) to open a stream with `EventSource` (no headers): `GET /live?ticket=…&topics=…`. */
  @Access('member', 'client', 'api_client')
  @Post('/tickets')
  async ticket(@Res() ctx: Context) {
    try {
      const ticket = randomBytes(24).toString('base64url');
      await redis().send('SET', [liveTicketKey(ticket), JSON.stringify({ token: this.auth.token, tenant: this.tenant.domain }), 'EX', String(TICKET_TTL_SECONDS)]);
      json(ctx, { ticket, url: `${env.HOST.replace(/\/$/, '')}/live?ticket=${ticket}`, expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString() }, 201);
    } catch (error) {
      jsonError(ctx, error, 'Failed to issue a ticket');
    }
  }
}

/** The capability URL of a case channel: no account; the signature names the institution, case, channel and expiry. */
@Controller({ path: '/live/cases' })
export class LiveChannelHandler {
  constructor(
    @Inject(LiveHub) private readonly hub: LiveHub,
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
  ) { }

  @Public()
  @Get('/:caseId/channels/:channel')
  async channel(@Param('caseId') caseId: string, @Param('channel') channel: string, @Res() ctx: Context) {
    try {
      const tenantId = ctx.req.query('tenant') ?? '';
      const expires = Number(ctx.req.query('expires'));
      if (!UUID.test(tenantId) || !UUID.test(caseId) || !/^[a-z][a-z0-9_-]{0,63}$/.test(channel) || !verifyChannelToken(ctx.req.query('token'), tenantId, caseId, channel, expires)) {
        return json(ctx, { error: 'This address is not valid (or it expired)' }, 403);
      }
      if (!(await this.repository.getCase(tenantId, caseId))) return json(ctx, { error: 'This address is not valid (or it expired)' }, 403);
      const since = ctx.req.query('since') ?? ctx.req.header('last-event-id') ?? '0';
      ctx.res = this.hub.open({
        tenantId, owner: `capability:${caseId}:${channel}`, topics: [`case/${caseId}/channel/${channel}`],
        since: /^\d+$/.test(since) ? Number(since) : 0, closeAt: expires * 1000,
      });
    } catch (error) {
      jsonError(ctx, error, 'Failed to open the live stream');
    }
  }
}
