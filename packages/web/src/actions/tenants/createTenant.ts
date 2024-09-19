"use server";
import { session } from '@descope/nextjs-sdk/server';
import { auth } from '@fintivio-sst/core/clients/auth.client';
import { type CreateTenant, TenantsService, UsersService, getInjector } from '@fintivio-sst/core/index';
import { omit } from 'lodash';

export const createTenant = async (tenant: CreateTenant) => {
  const onError = [] as Array<() => Promise<void>>;
  try {
    const injector = await getInjector();

    const currentSession = session();

    if (!currentSession.token) {
      throw new Error('Unauthorized');
    }

    console.log('currentSession', currentSession);

    const tenantsService = injector.resolve(TenantsService);

    const domainObject = await tenantsService.create(tenant);
    
    onError.push(async () => {
      await tenantsService.delete(tenant.domain);
    });

    const domainInjector = await getInjector(tenant.domain);

    const usersService = domainInjector.resolve(UsersService);

    const user = await auth.management.user.loadByUserId(currentSession.token.sub);

    console.log(user);

    await usersService.createUser({
      id: currentSession.token.sub,
      email: user.data.email,
      phoneNumber: user.data.phone,
      role: 'admin',
    });

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
export type CreatedTenant = Awaited<ReturnType<typeof createTenant>>;