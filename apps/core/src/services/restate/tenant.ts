import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { RestateService } from "./restate.abstract.service";
import { SdkResponse } from "@descope/node-sdk";
import { omit } from "lodash";
import { DomainsService } from "../domains.service";
import { InvitationsService } from "../invitations.service";
import { RolesService } from "../roles.service";
import { TenantsService } from "../tenants.service";
import { WebService } from "../web.service";
import { AUTH } from "../../injector/tokens/auth.token";
import { type AppAuth } from "../../clients/auth.client";
import { Scope, Injectable, Inject } from "@nestjs/common";
import { DeleteTenantRequest, GetTenantDatabaseRequest, GetTenantRequest, CreateTenant, CNAMERecordResponse as CNAMERecord, UpdateTenantRequest } from "@repo/fintivio/schemas";

@Injectable({
  scope: Scope.REQUEST
})
export class TenantService extends RestateService<'tenant'> {
  object = object({
    name: "tenant",
    handlers: {
      createTenant: async (c: ObjectContext, tenant: CreateTenant) => {
        console.log('Starting tenant creation process', { tenant });
        const onError = [] as Array<() => Promise<void>>;
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
            await this.tenantsService.delete(tenant.domain);
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
            await this.invitationsService.createInvitation(
              email,
              role,
              tenant.domain,
            ).catch(error => {
              console.error('Failed to create invitation', { email, error });
            });
          }

          let cnameRecords: CNAMERecord[] = [];

          if (tenant.allowedDomains.length) {
            console.log('Setting up tenant domains', { domains: tenant.allowedDomains });
            cnameRecords = await this.domainsService.setupTenantDomains({
              tenantDomains: tenant.allowedDomains,
            }).catch(error => {
              console.error('Failed to setup tenant domains', error);
              return [] as CNAMERecord[];
            });
          }

          const result = omit({
            ...domainObject,
            cnameRecords,
          }, [
            'databaseAuthToken',
            'databaseUrl',
            'databaseName',
          ]);
          console.log('Tenant creation completed successfully', { result });
          return result;
        } catch (error) {
          console.error('Tenant creation failed', error);

          for (const errorFn of onError) {
            await errorFn();
          }

          throw error;
        }
      },

      deleteTenant: async (c: ObjectContext, { userId, domain }: DeleteTenantRequest) => {
        console.log('Starting tenant deletion process', { userId, domain });

        const roles = await this.rolesService.getRolesByUserId({ userId });
        console.log('Got user roles', { roles });

        if (!roles.some(role => role === 'admin')) {
          console.error('Unauthorized deletion attempt', { userId, roles });
          throw new Error('Unauthorized');
        }

        console.log('Deleting tenant', { domain });
        return this.tenantsService.delete(domain);
      },

      getTenant: async (c: ObjectContext, { domain: domainRef }: GetTenantRequest) => {
        const tenantObject = domainRef ? await this.tenantsService.getByDomain(domainRef) : await this.tenantsService.getContextualTenant();

        return omit(tenantObject, [
          'databaseAuthToken',
          'databaseUrl',
          'databaseName',
        ]);
      },

      getTenantDatabase: async (c: ObjectContext, { domain }: GetTenantDatabaseRequest) => {
        return this.tenantsService.getPlatformDBClient(domain);
      },

      updateTenant: async (c: ObjectContext, { domain, data }: UpdateTenantRequest) => {
        return this.tenantsService.update(domain, data);
      },
    },
  });

  constructor(
    @Inject(DomainsService) private domainsService: DomainsService,
    @Inject(InvitationsService) private invitationsService: InvitationsService,
    @Inject(RolesService) private rolesService: RolesService,
    @Inject(TenantsService) private tenantsService: TenantsService,
    @Inject(WebService) private webService: WebService,
    @Inject(AUTH) private auth: AppAuth,

  ) {
    super();
  }
}
