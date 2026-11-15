import { Controller, Delete, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Public, Require } from '../auth/access';
import { IdentityService } from '../auth/identity.service';
import { ApiClientsService } from '../api-clients/api-clients.service';
import { clientCredentials } from '../api-clients/api-clients';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle, json } from '../http/respond';

/** The institution's API clients (OAuth 2.0 client credentials, docs/plans/04). */
@Controller({ path: '/api-clients', scope: Scope.REQUEST })
export class ApiClientsHandler {
  constructor(
    @Inject(ApiClientsService) private readonly clients: ApiClientsService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Require('api_clients:manage')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.clients.list(), 'Failed to list API clients');
  }

  /** `{ name, permissions[], expiresAt? }` → the client with its secret (shown once). */
  @Require('api_clients:manage')
  @Post()
  create(@Res() ctx: Context) {
    return handle(ctx, async () => this.clients.create(await this.request.json()), 'Failed to create the API client', 201);
  }

  @Require('api_clients:manage')
  @Post('/:clientId/rotate-secret')
  rotate(@Param('clientId') clientId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.clients.rotate(clientId), 'Failed to rotate the secret');
  }

  @Require('api_clients:manage')
  @Delete('/:clientId')
  revoke(@Param('clientId') clientId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.clients.revoke(clientId), 'Failed to revoke the API client', 204);
  }
}

/** OAuth 2.0 token endpoint for API clients (`grant_type=client_credentials`). */
@Public()
@Controller({ path: '/oauth', scope: Scope.REQUEST })
export class OAuthHandler {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  @Post('/token')
  async token(@Res() ctx: Context) {
    const type = this.request.headers.get('content-type') ?? '';
    const body: Record<string, string | undefined> = type.includes('application/json')
      ? await this.request.json().catch(() => ({}))
      : Object.fromEntries(new URLSearchParams(await this.request.text()));
    if (body.grant_type !== 'client_credentials') {
      json(ctx, { error: 'unsupported_grant_type' }, 400);
      return;
    }
    const { clientId, clientSecret } = clientCredentials(this.request.headers.get('authorization'), body);
    try {
      const result = await this.identity.issueApiClientToken(clientId, clientSecret);
      ctx.res = new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (error) {
      const status = (error as { status?: number }).status ?? 500;
      json(ctx, { error: status === 429 ? 'slow_down' : 'invalid_client', error_description: (error as Error).message }, status === 429 ? 429 : 401);
    }
  }
}
