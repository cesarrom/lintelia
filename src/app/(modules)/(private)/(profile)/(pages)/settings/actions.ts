'use server';

import { Service } from '@/lib/services/service';
import { revalidatePath } from 'next/cache';
import { inject } from '@/lib/injector/utils';
import { CreateSystemVariableInput, SystemVariablesService, UpdateSystemVariableInput } from '@/lib/services/system-variables.service';
import { session } from '@descope/nextjs-sdk/server';
import { auth } from '@/lib/clients/auth.client';
import { SdkResponse } from '@descope/node-sdk';
import { omit } from 'lodash';
import { SystemVariable } from '@/lib/entities';
import { container } from 'tsyringe';
import { CreateTenant, TenantsService } from '@/lib/services/tenants.service';
import { WebService } from '@/lib/services/web.service';
import { CNAMERecord, DomainsService } from '@/lib/services/domains.service';
import { InvitationsService } from '@/lib/services/invitations.service';
import { RolesService } from '@/lib/services/roles.service';

// Tenant Settings Actions
export const updateTenantSettings = inject(
  [TenantsService],
  async (context, [tenantsService], domain: string, data: {
    name?: string;
    logoUrl?: string;
    pallette?: {
      primary: string;
      secondary: string;
      accent: string;
    };
    allowedDomains?: string[];
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    country?: string;
    state?: string;
    zipCode?: string;
    startWorkingHour?: string;
    endWorkingHour?: string;
  }) => {
    const tenant = await tenantsService.update(domain, data);
    revalidatePath('/settings');
    return tenant;
  }
);

// System Variables Actions
export const getSystemVariables = inject(
  [SystemVariablesService],
  async (context, [systemVariablesService]): Promise<SystemVariable[]> => {
    const variables = await systemVariablesService.list();
    revalidatePath('/settings');
    return JSON.parse(JSON.stringify(variables));
  }
);

export const getSystemVariableNames = inject(
  [SystemVariablesService],
  async (context, [systemVariablesService]): Promise<(Omit<SystemVariable, 'value'>)[]> => {
    const variables = await systemVariablesService.list();
    revalidatePath('/settings');
    return JSON.parse(JSON.stringify(variables.map(v => ({
      ...v,
      'value': undefined
    }))));
  }
);

export const getSystemVariable = inject(
  [SystemVariablesService],
  async (context, [systemVariablesService], id: string): Promise<SystemVariable> => {
    return JSON.parse(JSON.stringify(await systemVariablesService.getById(id)));
  }
);

export const createSystemVariable = inject(
  [SystemVariablesService],
  async (context, [systemVariablesService], data: CreateSystemVariableInput): Promise<SystemVariable> => {
    const variable = await systemVariablesService.create(data);
    revalidatePath('/settings');
    return JSON.parse(JSON.stringify(variable));
  }
);

export const updateSystemVariable = inject(
  [SystemVariablesService],
  async (context, [systemVariablesService], id: string, data: UpdateSystemVariableInput): Promise<SystemVariable> => {
    const variable = await systemVariablesService.update(id, data);
    revalidatePath('/settings');
    return JSON.parse(JSON.stringify(variable));
  }
);

export const deleteSystemVariable = inject(
  [SystemVariablesService],
  async (context, [systemVariablesService], id: string) => {
    const success = await systemVariablesService.delete(id);
    revalidatePath('/settings');
    return success;
  }
); 

export type APICreateTenantRequest = CreateTenant & {
  individualContract: string;
  coApplicantContract: string;
  businessContract: string;
};

export const createTenant = async (tenant: APICreateTenantRequest) => {
  console.log('Starting tenant creation process', { tenant });
  const onError = [] as Array<() => Promise<void>>;
  try {
    console.log('Got injector');

    const currentSession = await session();
    console.log('Got current session');

    if (!currentSession?.token) {
      throw new Error('Unauthorized');
    }

    const sub = currentSession?.token?.sub || '';

    if (!sub) {
      throw new Error('Unauthorized');
    }
    console.log('Validated session and user', { sub });
    const injector = container.createChildContainer();
    const [tenantsService] = Service.inject([TenantsService], () => injector);
    
    const domainObject = await tenantsService.create(tenant);
    console.log('Created tenant domain object', { domainObject });

    onError.push(async () => {
      await tenantsService.delete(tenant.domain);
    });

    const [webService] = Service.inject([WebService], () => injector);

    webService.mockDomain(tenant.domain);

    const [domainsService, invitationsService] = Service.inject([DomainsService, InvitationsService], () => injector);

    const user = await auth.management.user.loadByUserId(sub);
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

    catchAuthError(await auth.management.tenant.createWithId(tenant.domain, tenant.name, tenant.allowedDomains));
    console.log('Created tenant in auth system', { domain: tenant.domain });

    catchAuthError(await auth.management.role.create('admin', 'Admin role', [], tenant.domain));
    console.log('Created admin role');
    for (const loginId of loginIds) {
      catchAuthError(await auth.management.user.addTenant(loginId, tenant.domain));
      console.log('Added user to tenant');

      catchAuthError(await auth.management.user.addTenantRoles(loginId, tenant.domain, ['admin']));
      console.log('Added admin role to user');
    }

    for (const { email, role } of tenant.invitee) {
      console.log('Creating invitation', { email, role });
      await invitationsService.createInvitation(
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
      cnameRecords = await domainsService.setupTenantDomains({
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
}

export const deleteTenant = async (userId: string, domain: string) => {
  console.log('Starting tenant deletion process', { userId, domain });
  const injector = container.createChildContainer();
  const [tenantsService, usersService] = Service.inject([TenantsService, RolesService], () => injector);

  const roles = await usersService.getRolesByUserId({ userId });
  console.log('Got user roles', { roles });

  if (!roles.some(role => role === 'admin')) {
    console.error('Unauthorized deletion attempt', { userId, roles });
    throw new Error('Unauthorized');
  }

  console.log('Deleting tenant', { domain });
  return tenantsService.delete(domain);
}

export type CreatedTenant = Awaited<ReturnType<typeof createTenant>>;

export const getTenant = async (domainRef?: string) => {
  const injector = container.createChildContainer();
  const [tenantsService] = Service.inject([TenantsService], () => injector);
  const tenantObject = domainRef ? await tenantsService.getByDomain(domainRef) : await tenantsService.getContextualTenant();

  return omit(tenantObject, [
    'databaseAuthToken',
    'databaseUrl',
    'databaseName',
  ]);
}

export const getTenantDatabase = async (domain: string) => {
  const injector = container.createChildContainer();
  const [tenantsService] = Service.inject([TenantsService], () => injector);

  return tenantsService.getPlatformDBClient(domain);
}

export type TenantDatabase = Awaited<ReturnType<typeof getTenantDatabase>>;
export type GetTenant = Awaited<ReturnType<typeof getTenant>>;
