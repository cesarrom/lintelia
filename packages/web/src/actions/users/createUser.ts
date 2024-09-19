"use server";
import { getInjector, UsersService } from '@fintivio-sst/core/index';
import { TenantDatabase } from '../tenants/getTenantDatabase';

export const createUser = async (user: { id: string, email: string, phoneNumber: string, role: string }, domain: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(UsersService);
  return applicationsService.createUser(user);
}

export type CreatedUser = Awaited<ReturnType<typeof createUser>>;