import assert from "assert";
import { KeyValueService } from "../services/key-value.service";
import { ProofOfLifeNodeConfig, type User, type Tenant } from "@repo/fintivio/schemas";
import { LogsService } from "../services/logs.service";
import { USER } from "../injector/tokens/user.token";
import { TENANT } from '../injector/tokens/tenant.token';
import { Inject, Scope, Controller, Get, Post, Res, Param } from "@nestjs/common";
import type { Context } from "hono";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/proof-of-life/:polId',
  scope: Scope.REQUEST
})
export class ProofOfLifeHandler {
  constructor(
    @Inject(LogsService) private logsService: LogsService,
    @Inject(KeyValueService) private keyValueService: KeyValueService,
    @Inject(USER) private user: User,
    @Inject(TENANT) private tenant: Tenant,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest,
  ) { }

  @Get()
  async fetchProofOfLifeConfig(@Res() ctx: Context, @Param('polId') polId: string): Promise<void> {
    assert(polId, 'polId parameter is required');
    assert(!!this.user, 'user is required');
    assert(!!this.tenant, 'tenant is required');

    const ID = `proof-of-life/${polId}`;

    try {
      const keyValue = await this.keyValueService.findById(ID);

      if (!keyValue) {
        ctx.res = new Response(JSON.stringify({ error: 'Key value not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
        return;
      }

      const { value } = keyValue;

      const responsePayload = JSON.parse(value) as ProofOfLifeNodeConfig & { attempt: number };

      ctx.res = new Response(JSON.stringify(responsePayload), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      this.logsService.error(`Failed to fetch proof-of-life config for ID ${ID}`, { message: error.message });
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to fetch proof-of-life configuration' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post()
  async submitProofOfLife(@Res() ctx: Context, @Param('polId') polId: string): Promise<void> {
    assert(polId, 'polId parameter is required');
    assert(!!this.user, 'user is required');
    assert(!!this.tenant, 'tenant is required');

    try {
      const { location, ip, confidence, deviceInfo }: { location: { lat: number; lng: number; }; ip: string; confidence: number, deviceInfo: object } = await (req.raw as any).json();

      await this.logsService.info('Proof of life submitted', {
        category: 'user',
        metadata: {
          id: `proof-of-life/${polId}`,
          uuid: polId,
          location,
          ip,
          confidence,
          deviceInfo,
        }
      });

      ctx.res = new Response(null, { status: 204 });

    } catch (error: any) {
      this.logsService.error(`Failed to submit proof-of-life for ID ${polId}`, { message: error.message });
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to submit proof-of-life' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}