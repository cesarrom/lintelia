"use server";
import { getInjector, UsersService } from '@fintivio-sst/core/index';
import { TenantDatabase } from '../tenants/getTenantDatabase';
import { auth } from '@fintivio-sst/core/clients/auth.client';

export const getUserById = async (userId: string, domain: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(UsersService);

  const user = await applicationsService.getUserById(userId);

  if (user) {
    return user;
  }

  const cloudUser = await auth.management.user.loadByUserId(userId);

  if (!cloudUser) {
    return null;
  }

  return applicationsService.createUser({
    id: userId,
    email: cloudUser.data.email,
    phoneNumber: cloudUser.data.phone,
    role: 'admin',
  });

}

export type User = Awaited<ReturnType<typeof getUserById>>;