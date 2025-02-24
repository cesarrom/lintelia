"use server";
import { TenantsService } from '@/lib/services';
import { omit } from 'lodash';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ENVIRONMENT_TOKEN } from '@/lib/injector/tokens';
import { getInjector } from '@/lib/injector';
import { env } from '@/lib/constants';

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
