"use server";
import { session } from '@descope/nextjs-sdk/server';
import { type CreateTenant, DomainsService, FormsService, InvitationsService, TenantsService, UserRolesService, env, getInjector } from '@/lib/services';
import { omit } from 'lodash';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/clients/auth.client';
import { ENVIRONMENT_TOKEN } from '@/lib/injector/tokens';

export type APICreateTenantRequest = CreateTenant & {
  individualContract: string;
  coApplicantContract: string;
  businessContract: string;
};

export const createTenant = async (tenant: APICreateTenantRequest) => {
  const onError = [] as Array<() => Promise<void>>;
  try {
    const injector = await getInjector();

    const currentSession = session();

    if (!currentSession.token) {
      throw new Error('Unauthorized');
    }

    const tenantsService = injector.resolve(TenantsService);
    const domainObject = await tenantsService.create(tenant);

    onError.push(async () => {
      await tenantsService.delete(tenant.domain);
    });

    const domainInjector = await getInjector(tenant.domain);

    const domainsService = domainInjector.resolve(DomainsService);

    const invitationsService = domainInjector.resolve(InvitationsService);

    const usersService = domainInjector.resolve(UserRolesService);

    const user = await auth.management.user.loadByUserId(currentSession.token.sub);

    const u = await usersService.createUserRole({
      userId: currentSession.token.sub,
      role: 'admin',
    });

    const formsService = domainInjector.resolve(FormsService);

    await formsService.setupInitialForms(currentSession.token.sub, {
      person: tenant.individualContract,
      'co-applicant': tenant.coApplicantContract,
      corporate: tenant.businessContract,
    });

    for (const { email, role } of tenant.invitee) {
      await invitationsService.createInvitation(
        email,
        role,
        tenant.domain,
      ).catch(console.error);
    }

    const cnameRecords = await domainsService.setupTenantDomains({
      tenantDomains: tenant.allowedDomains,
    }).catch(e => {
      console.error(e);
      return [];
    });

    return omit({
      ...domainObject,
      cnameRecords,
    }, [
      'databaseAuthToken',
      'databaseUrl',
      'databaseName',
    ]);
  } catch (error) {
    console.error(error);

    for (const errorFn of onError) {
      await errorFn();
    }

    throw error;
  }
}

export const deleteTenant = async (userId: string, domain: string) => {
  const injector = await getInjector();
  const tenantsService = injector.resolve(TenantsService);
  const usersService = injector.resolve(UserRolesService);

  const { role } = await usersService.getRoleByUserId(userId);

  if (role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return tenantsService.delete(domain);
}

export const getTenant = async (domainRef?: string) => {
  const headersList = await headers();
  const headerUrl = 'https://' + headersList.get('x-forwarded-host') || "";
  
  const url = new URL(headerUrl);
  // EX: https://galicia.fintivio.org/
  // tenant = galicia
  // domain = galicia.fintivio.org
  
  const tenant = url.hostname.split(".")[0];
  const domain = domainRef || url.hostname;
  
  const injector = await getInjector();
  
  const environment: typeof env = injector.resolve(ENVIRONMENT_TOKEN);

  const tenantsService = injector.resolve(TenantsService);

  let tenantObject = await tenantsService.getByDomain(domain);

  if (!tenantObject) {
    tenantObject = await tenantsService.getByDomain(tenant);
  }

  if (!tenantObject && !domain.includes('localhost')) {
    if (domain !== environment.DOMAIN) {
      redirect(environment.HOST);
    }
    return null;
  }

  return omit(tenantObject, [
    'databaseAuthToken',
    'databaseUrl',
    'databaseName',
  ]);
}

export const getTenantDatabase = async (domain: string) => {
  const injector = await getInjector(domain);
  const tenantsService = injector.resolve(TenantsService);

  return tenantsService.getPlatformDBClient(domain);
}

export type TenantDatabase = Awaited<ReturnType<typeof getTenantDatabase>>;
export type GetTenant = Awaited<ReturnType<typeof getTenant>>;
export type CreatedTenant = Awaited<ReturnType<typeof createTenant>>;