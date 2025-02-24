"use server";
import { session } from '@descope/nextjs-sdk/server';
import { CNAMERecord, type CreateTenant, DomainsService, InvitationsService, TenantsService, UserService } from '@/lib/services';
import { omit } from 'lodash';
import { auth } from '@/lib/clients/auth.client';
import { getInjector } from '@/lib/injector';
import { SdkResponse } from '@descope/node-sdk';

export type APICreateTenantRequest = CreateTenant & {
  individualContract: string;
  coApplicantContract: string;
  businessContract: string;
};

export const createTenant = async (tenant: APICreateTenantRequest) => {
  console.log('Starting tenant creation process', { tenant });
  const onError = [] as Array<() => Promise<void>>;
  try {
    const injector = await getInjector();
    console.log('Got injector');

    const currentSession = session();
    console.log('Got current session');

    if (!currentSession?.token) {
      throw new Error('Unauthorized');
    }

    const sub = currentSession?.token?.sub || '';

    if (!sub) {
      throw new Error('Unauthorized');
    }
    console.log('Validated session and user', { sub });

    const tenantsService = injector.resolve(TenantsService);
    const domainObject = await tenantsService.create(tenant);
    console.log('Created tenant domain object', { domainObject });

    onError.push(async () => {
      await tenantsService.delete(tenant.domain);
    });

    const domainInjector = await getInjector(tenant.domain);
    console.log('Got domain injector');

    const domainsService = domainInjector.resolve(DomainsService);
    const invitationsService = domainInjector.resolve(InvitationsService);

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
  const injector = await getInjector();
  const tenantsService = injector.resolve(TenantsService);
  const usersService = injector.resolve(UserService);

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