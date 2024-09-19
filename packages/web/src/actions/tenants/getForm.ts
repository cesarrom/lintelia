"use server";
import { FormsService, TenantsService, getInjector, tenantsDB } from '@fintivio-sst/core/index';

export const getCurrentForm = async (domain: string, _purpose: string) => {
  const injector = await getInjector(domain);

  const formsService = injector.resolve(FormsService);

  const forms = await formsService.getAllForms();

  return forms[0];
}

export type Form = Awaited<ReturnType<typeof getCurrentForm>>;