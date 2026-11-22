import { Controller, Delete, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { CustomDomainsService } from '../services/custom-domains.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';

/** Custom host names of the institution with DNS ownership verification (FIA-03). */
@Controller({ path: '/domains', scope: Scope.REQUEST })
export class DomainsHandler {
  constructor(
    @Inject(CustomDomainsService) private readonly domains: CustomDomainsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('domains:manage')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.domains.list(), 'Failed to list domains');
  }

  /** `{ hostname }` → the records to create (TXT ownership challenge, CNAME routing). */
  @Require('domains:manage')
  @Post()
  add(@Res() ctx: Context) {
    return handle(ctx, async () => this.domains.add(await this.request.json()), 'Failed to add the domain', 201);
  }

  @Require('domains:manage')
  @Post('/:hostname/verify')
  verify(@Param('hostname') hostname: string, @Res() ctx: Context) {
    return handle(ctx, () => this.domains.verify(hostname), 'Verification failed');
  }

  @Require('domains:manage')
  @Delete('/:hostname')
  remove(@Param('hostname') hostname: string, @Res() ctx: Context) {
    return handle(ctx, () => this.domains.remove(hostname), 'Failed to remove the domain', 204);
  }
}
