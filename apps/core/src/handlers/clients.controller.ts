import { Controller, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { ClientsService, FLAG_CATEGORIES } from '../services/clients.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle, json } from '../http/respond';

/** The institution's clients (end users). */
@Controller({ path: '/clients', scope: Scope.REQUEST })
export class ClientsHandler {
  constructor(
    @Inject(ClientsService) private readonly clients: ClientsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('clients:read')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.clients.list(new URL(this.request.url).searchParams.get('search') ?? undefined), 'Failed to list clients');
  }

  @Require('clients:read')
  @Get('/flag-categories')
  categories(@Res() ctx: Context) {
    json(ctx, FLAG_CATEGORIES);
  }

  @Require('clients:read')
  @Get('/:clientId')
  get(@Param('clientId') clientId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.clients.get(clientId), 'Failed to load the client');
  }

  /** Flag for suspicious activity: starts the workflows subscribed to `client.flagged`. */
  @Require('clients:update')
  @Post('/:clientId/flags')
  flag(@Param('clientId') clientId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.clients.flag(clientId, await this.request.json()), 'Failed to flag the client', 201);
  }
}
