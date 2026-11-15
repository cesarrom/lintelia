import { SdkResponse } from "@descope/node-sdk";
import { omit } from "lodash";
import { DomainsService } from "../services/domains.service";
import { InvitationsService } from "../services/invitations.service";
import { RolesService } from "../services/roles.service";
import { TenantsService } from "../services/tenants.service";
import { WebService } from "../services/web.service";
import { AUTH } from "../injector/tokens/auth.token";
import { type AppAuth } from "../clients/auth.client";
import { Scope, Inject, Controller, Post, Delete, Get, Put, Req, Res, type RawBodyRequest, Param } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import type { CreateTenant, CNAMERecordResponse as CNAMERecord, UpdateTenantRequest } from "@repo/fintivio/schemas";
import assert from 'assert';
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/tenants',
  scope: Scope.REQUEST
})
export class TenantHandler {
  constructor(
    @Inject(DomainsService) private domainsService: DomainsService,
    @Inject(InvitationsService) private invitationsService: InvitationsService,
    @Inject(RolesService) private rolesService: RolesService,
    @Inject(TenantsService) private tenantsService: TenantsService,
    @Inject(WebService) private webService: WebService,
    @Inject(AUTH) private auth: AppAuth,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest
  ) { }

  @Post()
  async createTenant(@Res() ctx: Context): Promise<void> {
    let tenant: CreateTenant | null = null;
    try {
      tenant = await this.requestProxy.json();
      assert(tenant, 'Tenant data is required in the request body');
      assert(tenant.domain, 'Tenant domain is required');
      assert(tenant.name, 'Tenant name is required');

      console.log('Starting tenant creation process', { tenant });
      const onError = [] as Array<() => Promise<void>>;
      let createdTenantResult: any = null;

      try {
        console.log('Got injector');

        const sub = await this.webService.getUserId();

        if (!sub) {
          throw new Error('Unauthorized');
        }
        console.log('Validated session and user', { sub });

        const domainObject = await this.tenantsService.create(tenant);
        console.log('Created tenant domain object', { domainObject });

        onError.push(async () => {
          await this.tenantsService.delete(tenant!.domain);
        });

        this.webService.mockDomain(tenant.domain);

        const user = await this.auth.management.user.loadByUserId(sub);
        console.log('Loaded user', { userId: sub });
        const loginIds = user?.data?.loginIds || [];

        if (!user || !loginIds.length) {
          throw new Error('User not found');
        }

        const errors: Error[] = [];

        const catchAuthError = (sdkResponse: SdkResponse<any>) => {
          if (sdkResponse.error) {
            const e = new Error(sdkResponse.error.errorMessage || sdkResponse.error.errorDescription || sdkResponse.error.errorCode || 'Unknown error');
            console.error(e);
            errors.push(e);
          }
        }

        catchAuthError(await this.auth.management.tenant.createWithId(tenant.domain, tenant.name, tenant.allowedDomains));
        console.log('Created tenant in auth system', { domain: tenant.domain });

        catchAuthError(await this.auth.management.role.create('admin', 'Admin role', [], tenant.domain));
        console.log('Created admin role');
        for (const loginId of loginIds) {
          catchAuthError(await this.auth.management.user.addTenant(loginId, tenant.domain));
          console.log('Added user to tenant');

          catchAuthError(await this.auth.management.user.addTenantRoles(loginId, tenant.domain, ['admin']));
          console.log('Added admin role to user');
        }

        for (const { email, role } of tenant.invitee) {
          console.log('Creating invitation', { email, role });
          await this.invitationsService.createInvitation(email, role, tenant.domain)
            .catch(error => {
              console.error('Failed to create invitation', { email, error });
            });
        }

        let cnameRecords: CNAMERecord[] = [];

        if (tenant.allowedDomains.length) {
          console.log('Setting up tenant domains', { domains: tenant.allowedDomains });
          cnameRecords = await this.domainsService.setupTenantDomains({ tenantDomains: tenant.allowedDomains })
            .catch(error => {
              console.error('Failed to setup tenant domains', error);
              return [] as CNAMERecord[];
            });
        }

        createdTenantResult = omit({
          ...domainObject,
          cnameRecords,
        }, ['databaseAuthToken', 'databaseUrl', 'databaseName']);
        console.log('Tenant creation completed successfully', { result: createdTenantResult });

        ctx.res = new Response(JSON.stringify(createdTenantResult), {
          headers: { 'Content-Type': 'application/json' },
          status: 201
        });

      } catch (innerError: any) {
        console.error('Tenant creation failed during process', innerError);
        for (const errorFn of onError) {
          await errorFn().catch(rollbackError => console.error('Rollback function failed', rollbackError));
        }
        throw innerError;
      }
    } catch (error: any) {
      console.error('Tenant creation request failed', error);
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to create tenant' }), {
        headers: { 'Content-Type': 'application/json' },
        status: error.message === 'Unauthorized' ? 401 : 500
      });
    }
    return;
  }

  @Delete('/:domain')
  async deleteTenant(@Res() ctx: Context, @Param('domain') domain: string): Promise<void> {
    assert(domain, 'domain parameter is required');

    try {
      const userId = await this.webService.getUserId();
      assert(userId, 'User not authenticated');

      console.log('Starting tenant deletion process', { userId, domain });

      const roles = await this.rolesService.getRolesByUserId({ userId });
      console.log('Got user roles', { roles });

      if (!roles.some(role => role === 'admin')) {
        console.error('Unauthorized deletion attempt', { userId, roles });
        ctx.res = new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 403
        });
        return;
      }

      console.log('Deleting tenant', { domain });
      await this.tenantsService.delete(domain);

      ctx.res = new Response(null, {
        headers: { 'Content-Type': 'application/json' },
        status: 204
      });


    } catch (error: any) {
      console.error('Tenant deletion failed', error);
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to delete tenant' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get()
  async getTenant(@Res() ctx: Context): Promise<void> {
    const request = this.requestProxy
    const url = new URL(request.url);
    const domainRef = url.searchParams.get('domain');
    console.log('Get tenant request received', { domainRef });

    try {
      const tenantObject = domainRef
        ? await this.tenantsService.getByDomain(domainRef)
        : await this.tenantsService.getContextualTenant();

      if (!tenantObject) {
        ctx.res = new Response(JSON.stringify({ error: 'Tenant not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        const result = omit(tenantObject, ['databaseAuthToken', 'databaseUrl', 'databaseName']);
        ctx.res = new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      console.error('Get tenant failed', error);
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get tenant' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Put('/:domain')
  async updateTenant(@Res() ctx: Context): Promise<void> {
    const request = this.requestProxy;
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');
    
    assert(domain, 'domain parameter is required');

    try {
      const { data }: Pick<UpdateTenantRequest, 'data'> = await (req.raw as any).json();
      assert(data, 'data is required in the request body');
      console.log('Update tenant request received', { domain, data });

      const updatedTenant = await this.tenantsService.update(domain, data);

      if (!updatedTenant) {
        ctx.res = new Response(JSON.stringify({ error: 'Tenant not found for update' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        const result = omit(updatedTenant, ['databaseAuthToken', 'databaseUrl', 'databaseName']);
        ctx.res = new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      console.error('Update tenant failed', error);
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to update tenant' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}
