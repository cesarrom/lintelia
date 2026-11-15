import { Scope, Inject, Controller, Post, Delete, Get, Put, Res, Param } from "@nestjs/common";
import type { Context } from "hono";
import type { CreateTenant, UpdateTenantRequest } from "@repo/fintivio/schemas";
import { TenantsService } from "../services/tenants.service";
import { Access, Require, RequirePlatform } from "../auth/access";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
import { json, jsonError } from "../http/respond";

/**
 * Tenant directory. Platform staff onboard (create), list and remove institutions; tenant administrators read and
 * update their own tenant (authorization is enforced in TenantsService and by row level security).
 */
@Controller({
  path: '/tenants',
  scope: Scope.REQUEST
})
export class TenantHandler {
  constructor(
    @Inject(TenantsService) private tenantsService: TenantsService,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest
  ) { }

  @RequirePlatform('platform.tenants:create')
  @Post()
  async createTenant(@Res() ctx: Context): Promise<void> {
    try {
      const tenant = await this.requestProxy.json<CreateTenant>();
      json(ctx, await this.tenantsService.create(tenant), 201);
    } catch (error) {
      jsonError(ctx, error, 'Failed to create tenant');
    }
  }

  @RequirePlatform('platform.tenants:read')
  @Get('/all')
  async listTenants(@Res() ctx: Context): Promise<void> {
    try {
      json(ctx, await this.tenantsService.getAllTenants());
    } catch (error) {
      jsonError(ctx, error, 'Failed to list tenants');
    }
  }

  /** GET /tenants?domain=... (or the caller's own tenant without the parameter). */
  @Access('member', 'client')
  @RequirePlatform('platform.tenants:read')
  @Get()
  async getTenant(@Res() ctx: Context): Promise<void> {
    try {
      const domainRef = new URL(this.requestProxy.url).searchParams.get('domain');
      const tenant = domainRef
        ? await this.tenantsService.getByDomain(domainRef)
        : await this.tenantsService.getContextualTenant();
      if (!tenant) return json(ctx, { error: 'Tenant not found' }, 404);
      json(ctx, tenant);
    } catch (error) {
      jsonError(ctx, error, 'Failed to get tenant');
    }
  }

  /** PUT /tenants with `{ domain, data }` (what the web app sends) or PUT /tenants/:domain with `{ data }`. */
  @Require('workspace:update')
  @RequirePlatform('platform.tenants:update')
  @Put(['/', '/:domain'])
  async updateTenant(@Res() ctx: Context, @Param('domain') domainParam?: string): Promise<void> {
    try {
      const body = await this.requestProxy.json<Partial<UpdateTenantRequest>>();
      const domain = domainParam ?? body.domain;
      if (!domain || !body.data) return json(ctx, { error: 'domain and data are required' }, 400);
      json(ctx, await this.tenantsService.update(domain, body.data));
    } catch (error) {
      jsonError(ctx, error, 'Failed to update tenant');
    }
  }

  /** DELETE /tenants with `{ domain }` in the body (what the web app sends) or DELETE /tenants/:domain. */
  @RequirePlatform('platform.tenants:delete')
  @Delete(['/', '/:domain'])
  async deleteTenant(@Res() ctx: Context, @Param('domain') domainParam?: string): Promise<void> {
    try {
      const domain = domainParam ?? (await this.requestProxy.json<{ domain?: string }>().catch(() => ({ domain: undefined }))).domain;
      if (!domain) return json(ctx, { error: 'domain is required' }, 400);
      await this.tenantsService.delete(domain);
      ctx.res = new Response(null, { status: 204 });
    } catch (error) {
      jsonError(ctx, error, 'Failed to delete tenant');
    }
  }
}
