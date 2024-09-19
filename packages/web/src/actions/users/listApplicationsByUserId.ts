"use server";
import { ApplicationsService, getInjector } from '@fintivio-sst/core/index';

export const listApplicationsByUserId = async (userId: string, domain: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  return applicationsService.getApplicationsByUserId(userId);
}

export type Application = Awaited<ReturnType<typeof listApplicationsByUserId>>[0];