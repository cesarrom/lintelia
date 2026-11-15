import { Controller, Get, Inject, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Public } from '../auth/access';
import { ConnectorApiService } from '../integrations/connector-api.service';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle, jsonError } from '../http/respond';
import { jwks } from '../auth/signing-keys';

/**
 * The API connectors call (docs/plans/03). Public at the route level: each call is authenticated inside with the
 * connector's private_key_jwt (token endpoint) or an installation access token (everything else).
 */
@Public()
@Controller({ path: '/connector-api', scope: Scope.REQUEST })
export class ConnectorApiHandler {
  constructor(
    @Inject(ConnectorApiService) private readonly api: ConnectorApiService,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
  ) { }

  private get authorization() {
    return this.request.headers.get('authorization');
  }

  private async body(): Promise<Record<string, any>> {
    const type = this.request.headers.get('content-type') ?? '';
    if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(await this.request.text()));
    return this.request.json().catch(() => ({}));
  }

  @Post('/oauth/token')
  async token(@Res() ctx: Context) {
    try {
      const result = await this.api.token(await this.body());
      ctx.res = new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    } catch (error) {
      jsonError(ctx, error, 'Token request failed', 400);
    }
  }

  @Get('/installation')
  getInstallation(@Res() ctx: Context) {
    return handle(ctx, async () => this.api.getInstallation(await this.api.authenticate(this.authorization)), 'Failed');
  }

  @Put('/installation')
  updateInstallation(@Res() ctx: Context) {
    return handle(ctx, async () => this.api.updateInstallation(await this.api.authenticate(this.authorization, 'installation:write'), await this.body()), 'Failed to update the installation');
  }

  @Post('/executions/complete')
  complete(@Res() ctx: Context) {
    return handle(ctx, async () => this.api.complete(await this.api.authenticate(this.authorization), await this.body()), 'Failed to complete the step');
  }

  @Post('/records')
  record(@Res() ctx: Context) {
    return handle(ctx, async () => this.api.upsertRecord(await this.api.authenticate(this.authorization, 'records:write'), await this.body()), 'Failed to write the record');
  }

  /** A document for a case (base64 JSON body, ≤ 50 MB): scanned before it appears on the case. */
  @Post('/files')
  file(@Res() ctx: Context) {
    return handle(ctx, async () => this.api.uploadFile(await this.api.authenticate(this.authorization, 'files:write'), await this.body()), 'Failed to upload the document', 202);
  }

  @Post('/events')
  event(@Res() ctx: Context) {
    return handle(ctx, async () => this.api.publishEvent(await this.api.authenticate(this.authorization, 'events:publish'), await this.body()), 'Failed to publish the event', 202);
  }
}

/** Public keys of the core (connectors verify the core's requests and tokens). */
@Public()
@Controller({ path: '/.well-known' })
export class WellKnownHandler {
  @Get('/jwks.json')
  async jwks(@Res() ctx: Context) {
    ctx.res = new Response(JSON.stringify(await jwks()), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } });
  }
}
