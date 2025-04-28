'use server';

import { Service } from "../services/service";
import { container } from "tsyringe";
import { TenantsService } from "../services/tenants.service";
import { UsersService } from "../services/users.service";

const promiseResultOrNull = <T>(promise: Promise<T>): Promise<T | null> => promise.catch((e) => {
  console.error(e);
  return null;
});

export const getUser = async (id?: string) => {
  const injector = container.createChildContainer();
  const [usersService] = Service.inject([UsersService], () => injector);
  const user = await promiseResultOrNull(usersService.getSessionUser());

  return user;
}

export const getContextualInjector = async (domain?: string) => {
  const injector = container.createChildContainer();
  const [tenantsService] = Service.inject([TenantsService], () => injector);
  const [usersService] = Service.inject([UsersService], () => injector);
  const user = await promiseResultOrNull(usersService.getSessionUser());
  const tenant = await promiseResultOrNull(domain ? tenantsService.getByDomain(domain) : tenantsService.getContextualTenant());

  return {
    tenant,
    injector,
    user,
  } as {
    tenant?: typeof tenant;
    injector: typeof injector;
    user?: typeof user;
  }
}