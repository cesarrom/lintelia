"use server";
import { session } from '@descope/nextjs-sdk/server';
import { auth } from '@fintivio-sst/core/clients/auth.client';
import { type CreateTenant, FormsService, InvitationsService, TenantsService, UserRolesService, env, getInjector } from '@fintivio-sst/core/index';
import { ENVIRONMENT_TOKEN } from '@fintivio-sst/core/libs/injector/tokens';
import { omit } from 'lodash';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const createTenant = async (tenant: CreateTenant) => {
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

    const invitationsService = domainInjector.resolve(InvitationsService);

    const usersService = domainInjector.resolve(UserRolesService);

    const user = await auth.management.user.loadByUserId(currentSession.token.sub);

    const u = await usersService.createUserRole({
      userId: currentSession.token.sub,
      role: 'admin',
    });

    const formsService = domainInjector.resolve(FormsService);

    await formsService.setupInitialForms(currentSession.token.sub);

    for (const { email, role } of tenant.invitee) {
      await invitationsService.createInvitation(
        email,
        role,
        tenant.domain,
      ).catch(console.error);
    }

    return omit(domainObject, [
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

export const getTenant = async () => {
  const headersList = headers();
  const headerUrl = 'https://' + headersList.get('x-forwarded-host') || "";

  const url = new URL(headerUrl);
  // EX: https://galicia.fintivio.org/
  // tenant = galicia
  // domain = galicia.fintivio.org

  const tenant = url.hostname.split(".")[0];
  const domain = url.hostname;

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