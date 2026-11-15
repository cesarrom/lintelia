import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { Require } from '../auth/access';
import { IdentityService } from '../auth/identity.service';
import { CasesService } from '../services/cases.service';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';
import { BadRequestError } from '../http/errors';

/** Cases of the institution (docs/architecture/cases-and-workflows.md). Scope is enforced by CasesService. */
@Controller({ path: '/cases', scope: Scope.REQUEST })
export class CasesHandler {
  constructor(
    @Inject(CasesService) private readonly cases: CasesService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('cases:read')
  @Get()
  list(@Res() ctx: Context) {
    const q = new URL(this.request.url).searchParams;
    return handle(ctx, () => this.cases.list({
      status: q.get('status') ?? undefined,
      workflowId: q.get('workflowId') ?? undefined,
      applicantId: q.get('applicantId') ?? undefined,
      search: q.get('search') ?? undefined,
    }), 'Failed to list cases');
  }

  /**
   * A member opens a case on a published workflow. With a client (`client` or `applicant`: e-mail, name) it is an
   * assisted application: the client confirms it in their portal before the workflow starts. Without one, the
   * workflow starts at once (e.g. an internal review). Body: `{ workflowId, client?, inputs? }`.
   */
  @Require('cases:create')
  @Post()
  start(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{
        workflowId?: string;
        inputs?: Record<string, unknown>;
        data?: Record<string, unknown>;
        client?: { email?: string; name?: string };
        applicant?: { email?: string; name?: string };
      }>();
      if (!body?.workflowId) throw new BadRequestError('workflowId is required');
      const inputs = body.inputs ?? body.data ?? {};
      const person = body.client ?? body.applicant;
      const kase = person?.email
        ? await (async () => {
          const client = await this.identity.ensureClient(this.tenant, person.email!, person.name);
          return this.cases.startAssisted({ workflowId: body.workflowId!, applicant: { id: client.id, email: client.email, name: person.name ?? client.name }, data: inputs });
        })()
        : await this.cases.start({
          workflowId: body.workflowId, data: inputs, source: 'manual',
          initiatedBy: { type: 'member', id: this.user.userId, email: this.user.email },
        });
      return this.cases.get(kase.id);
    }, 'Failed to start the case', 201);
  }

  /** E-mail the applicant the link to their application again. */
  @Require('clients:update')
  @Post('/:caseId/resend-link')
  resendLink(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.cases.resendLink(caseId), 'Failed to resend the link', 202);
  }

  @Require('cases:read')
  @Get('/:caseId')
  get(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.cases.get(caseId), 'Failed to load the case');
  }

  @Require('cases:read')
  @Get('/:caseId/timeline')
  timeline(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.cases.timeline(caseId), 'Failed to load the timeline');
  }

  @Require('cases:read', 'cases:export')
  @Get('/:caseId/export')
  async export(@Param('caseId') caseId: string, @Res() ctx: Context) {
    await handle(ctx, () => this.cases.export(caseId), 'Failed to export the case');
    if (ctx.res.status === 200) ctx.res.headers.set('Content-Disposition', `attachment; filename="case-${caseId}.json"`);
  }
}
