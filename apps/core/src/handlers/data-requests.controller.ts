import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Access, Require } from '../auth/access';
import { DataRequestsService } from '../services/data-requests.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';

/** Compliance side of data-rights requests. */
@Controller({ path: '/data-requests', scope: Scope.REQUEST })
export class DataRequestsHandler {
  constructor(
    @Inject(DataRequestsService) private readonly requests: DataRequestsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('data_requests:manage')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.requests.list(new URL(this.request.url).searchParams.get('status') ?? undefined), 'Failed to list requests');
  }

  @Require('data_requests:manage')
  @Post('/:requestId/complete')
  complete(@Param('requestId') requestId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.requests.complete(requestId), 'Failed to complete the request');
  }
}

/** Client side: file a request, follow it, download the export. */
@Access('client')
@Controller({ path: '/me/data-requests', scope: Scope.REQUEST })
export class MyDataRequestsHandler {
  constructor(
    @Inject(DataRequestsService) private readonly requests: DataRequestsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Post()
  file(@Res() ctx: Context) {
    return handle(ctx, async () => this.requests.file((await this.request.json<{ type?: string }>()).type ?? ''), 'Failed to file the request', 202);
  }

  @Get()
  mine(@Res() ctx: Context) {
    return handle(ctx, () => this.requests.mine(), 'Failed to list your requests');
  }

  @Get('/:requestId/export')
  async download(@Param('requestId') requestId: string, @Res() ctx: Context) {
    await handle(ctx, () => this.requests.myExport(requestId), 'Export not available');
    if (ctx.res.status === 200) ctx.res.headers.set('Content-Disposition', 'attachment; filename="my-data.json"');
  }
}
