"use server";
import { TenantsService, getInjector, tenantsDB } from '@fintivio-sst/core/index';
import { omit } from 'lodash';
import { headers } from 'next/headers';

export const getTenant = async () => {
  const headersList = headers();
  const headerUrl = 'https://' + headersList.get('x-forwarded-host') || "";
  console.log({ headerUrl });
  const url = new URL(headerUrl); 
  // EX: https://galicia.fintivio.org/
  // tenant = galicia
  // domain = galicia.fintivio.org

  const tenant = url.hostname.split(".")[0];
  const domain = url.hostname;

  const injector = await getInjector();

  const tenantsService = injector.resolve(TenantsService);

  let tenantObject = await tenantsService.getByDomain(domain);

  if (!tenantObject) {
    tenantObject = await tenantsService.getByDomain(tenant);
  }

  if (!tenantObject) {
    throw new Error('Tenant not found');
  }

  return omit(tenantObject, [
    'databaseAuthToken',
    'databaseUrl',
    'databaseName',
  ]);
}

export type GetTenant = Awaited<ReturnType<typeof getTenant>>;