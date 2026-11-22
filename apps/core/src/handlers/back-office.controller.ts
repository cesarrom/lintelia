import { Controller, Get, Inject, Param, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Access, Require } from '../auth/access';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';
import { BadRequestError } from '../http/errors';
import { BackOfficeStudioService } from '../back-office/studio.service';
import { BackOfficeRuntimeService } from '../back-office/runtime.service';

/**
 * The institution's own back office (docs/plans/16). Studio (`backoffice:*`): the draft, validation, publication,
 * versions, preview as roles, access report. Runtime (every member): the published definition pruned for them, the data
 * of its pages, its actions and the staff screens they open — all re-checked on use.
 */
@Controller({ path: '/backoffice', scope: Scope.REQUEST })
export class BackOfficeHandler {
  constructor(
    @Inject(BackOfficeStudioService) private readonly studio: BackOfficeStudioService,
    @Inject(BackOfficeRuntimeService) private readonly runtime: BackOfficeRuntimeService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  private body<T>() {
    return this.request.json<T>().catch(() => ({} as T));
  }

  // --- studio --------------------------------------------------------------------------------------------------------

  @Require('backoffice:read')
  @Get('/current')
  current(@Res() ctx: Context) {
    return handle(ctx, () => this.studio.current(), 'Failed to load the back office');
  }

  @Require('backoffice:manage')
  @Put('/current/draft')
  saveDraft(@Res() ctx: Context) {
    return handle(ctx, async () => this.studio.saveDraft(await this.body()), 'Failed to save the draft');
  }

  @Require('backoffice:read')
  @Post('/current/validate')
  validate(@Res() ctx: Context) {
    return handle(ctx, async () => this.studio.validate(await this.body()), 'Failed to validate');
  }

  @Require('backoffice:publish')
  @Post('/current/publish')
  publish(@Res() ctx: Context) {
    return handle(ctx, () => this.studio.publish(), 'Failed to publish');
  }

  /** Roll back (or forward) to a published version: `{ version }`. */
  @Require('backoffice:publish')
  @Post('/current/activate')
  activate(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const { version } = await this.body<{ version?: number }>();
      if (!Number.isInteger(version)) throw new BadRequestError('version is required');
      return this.studio.activate(version!);
    }, 'Failed to activate the version');
  }

  @Require('backoffice:read')
  @Get('/current/versions/:version')
  version(@Param('version') version: string, @Res() ctx: Context) {
    return handle(ctx, () => this.studio.version(Number(version)), 'Failed to load the version');
  }

  @Require('backoffice:read')
  @Get('/templates')
  templates(@Res() ctx: Context) {
    return handle(ctx, () => this.studio.templates(), 'Failed to list the templates');
  }

  /** Replace the draft with a template (`{ template }`); the fee waivers template also creates what it needs. */
  @Require('backoffice:manage')
  @Post('/current/template')
  installTemplate(@Res() ctx: Context) {
    return handle(ctx, async () => this.studio.installTemplate(await this.body()), 'Failed to install the template');
  }

  /** The draft as members holding these roles (and attributes) would get it: `{ roles, attributes?, definition? }`. */
  @Require('backoffice:read', 'roles:read')
  @Post('/current/preview')
  preview(@Res() ctx: Context) {
    return handle(ctx, async () => this.studio.previewAs(await this.body()), 'Failed to preview');
  }

  /** Per role: what it gets from the draft, and what it would see empty. */
  @Require('backoffice:read', 'roles:read')
  @Post('/current/access-report')
  accessReport(@Res() ctx: Context) {
    return handle(ctx, async () => this.studio.accessReport(await this.body()), 'Failed to build the access report');
  }

  // --- runtime ---------------------------------------------------------------------------------------------------------

  @Access('member')
  @Get('/app')
  app(@Res() ctx: Context) {
    return handle(ctx, () => this.runtime.app(), 'Failed to load the back office');
  }

  /** `{ page, context?: { client?, case? } }` or `{ slot: 'dashboard' }`. */
  @Access('member')
  @Post('/data')
  data(@Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.data(await this.body()), 'Failed to load the data');
  }

  /** `{ context?: { client?, case? }, input? }` → where the case stands for the member (their first screen). */
  @Access('member')
  @Post('/actions/:key')
  run(@Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.runAction(key, await this.body()), 'Failed to run the action', 201);
  }

  @Access('member')
  @Get('/cases/:caseId/progress')
  progress(@Param('caseId') caseId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.runtime.progress(caseId), 'Failed to load the progress');
  }

  /** The staff screens waiting for this member to send. */
  @Access('member')
  @Get('/screens')
  screens(@Res() ctx: Context) {
    return handle(ctx, () => this.runtime.myScreens(), 'Failed to list your screens');
  }

  /** Send a staff screen: `{ event, values }`. */
  @Access('member')
  @Post('/screens/:taskId')
  submit(@Param('taskId') taskId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.runtime.submitScreen(taskId, await this.body()), 'Failed to send the screen');
  }
}
