"use server";
import { TenantsService, tenantsDB } from '@fintivio-sst/core/index';
import { omit } from 'lodash';

export const getTenant = async (domain: string) => {
  const tenantsService = new TenantsService(tenantsDB);

  const domainObject = await tenantsService.getByDomain(domain);

  return omit(domainObject, [
    'databaseAuthToken',
    'databaseUrl',
    'databaseName',
  ]);
}

export type GetTenant = Awaited<ReturnType<typeof getTenant>>;