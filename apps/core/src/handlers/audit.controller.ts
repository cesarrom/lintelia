import { Controller, Get, Inject, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { AUTH_CONTEXT } from '../injector/tokens/auth-context.token';
import type { AuthContext } from '../auth/auth-context';
import { AuditWriter } from '../services/audit.writer';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { json } from '../http/respond';

/** The tenant's append-only audit trail. */
@Controller({ path: '/audit', scope: Scope.REQUEST })
export class AuditHandler {
  constructor(
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  private filter() {
    const q = new URL(this.request.url).searchParams;
    return {
      caseId: q.get('caseId') ?? undefined,
      action: q.get('action') ?? undefined,
      actorType: q.get('actorType') ?? undefined,
      from: q.get('from') ? new Date(q.get('from')!) : undefined,
      to: q.get('to') ? new Date(q.get('to')!) : undefined,
      order: (q.get('order') === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
      limit: q.get('limit') ? Number(q.get('limit')) : undefined,
    };
  }

  @Require('audit:read')
  @Get()
  async list(@Res() ctx: Context) {
    json(ctx, await this.audit.list(this.auth.tenant!.id, this.filter()));
  }

  /** JSON Lines export (`?format=jsonl`), oldest first. */
  @Require('audit:export')
  @Get('/export')
  async export(@Res() ctx: Context) {
    const entries = await this.audit.list(this.auth.tenant!.id, { ...this.filter(), order: 'asc', limit: 5000 });
    ctx.res = new Response(entries.map((e) => JSON.stringify(e)).join('\n') + '\n', {
      headers: { 'Content-Type': 'application/x-ndjson', 'Content-Disposition': 'attachment; filename="audit.jsonl"' },
    });
  }
}
