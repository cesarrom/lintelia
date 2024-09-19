"use server";
import { TenantsService, getInjector, tenantsDB } from '@fintivio-sst/core/index';

export const getTenantDatabase = async (domain: string) => {
  const injector = await getInjector(domain);
  const tenantsService = injector.resolve(TenantsService);

  return tenantsService.getPlatformDBClient(domain);
}

export type TenantDatabase = Awaited<ReturnType<typeof getTenantDatabase>>;