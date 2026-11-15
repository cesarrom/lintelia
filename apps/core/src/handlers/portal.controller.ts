import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Access } from '../auth/access';
import { ClientTasksService } from '../services/tasks.service';
import { PartiesService } from '../services/parties.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';

/** Client portal: my applications and the requests waiting for me. Clients only ever see their own data. */
@Access('client')
@Controller({ path: '/me', scope: Scope.REQUEST })
export class PortalHandler {
  constructor(
    @Inject(ClientTasksService) private readonly portal: ClientTasksService,
    @Inject(PartiesService) private readonly partiesService: PartiesService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Get('/cases')
  cases(@Res() ctx: Context) {
    return handle(ctx, () => this.portal.myCases(), 'Failed to list your applications');
  }

  @Get('/cases/:caseId')
  case(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.portal.myCase(caseId), 'Failed to load your application');
  }

  /** Confirm an application prepared by an adviser, with consent: `{ consent: true }`. */
  @Post('/cases/:caseId/confirm')
  confirm(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.portal.confirm(caseId, await this.request.json()), 'Failed to confirm the application');
  }

  @Post('/cases/:caseId/requests/:taskId/respond')
  respond(@Param('caseId') caseId: string, @Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.portal.respond(caseId, taskId, (await this.request.json<{ response?: Record<string, unknown> }>()).response ?? {}), 'Failed to send your answer');
  }

  /** Related parties of my application (I am the applicant). */
  @Get('/cases/:caseId/parties')
  listParties(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.partiesService.list(caseId), 'Failed to list the parties');
  }

  /** `{ role, email, name, share? }`: invite a co-applicant, guarantor, director or beneficial owner. */
  @Post('/cases/:caseId/parties')
  invite(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.partiesService.invite(caseId, await this.request.json()), 'Failed to invite', 201);
  }

  /** The list is complete: the application continues. */
  @Post('/cases/:caseId/parties/complete')
  completeParties(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.partiesService.complete(caseId), 'Failed to confirm the parties');
  }

  @Get('/requests')
  requests(@Res() ctx: Context) {
    return handle(ctx, () => this.portal.myRequests(), 'Failed to list your requests');
  }

  /** The form of a `form.request` step. */
  @Get('/requests/:taskId/form')
  requestForm(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.portal.requestForm(taskId), 'Failed to load the form');
  }

  @Post('/requests/:taskId/respond')
  respondToRequest(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.portal.respondToRequest(taskId, (await this.request.json<{ response?: Record<string, unknown> }>()).response ?? {}), 'Failed to send your answer');
  }
}
