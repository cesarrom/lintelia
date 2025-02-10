'use server';

import { getInjector } from "@/lib/injector";
import { getTenant } from "../tenants";

export const getContextualInjector = async (domain?: string) => {
  const tenant = await getTenant(domain);
  const injector = await getInjector(tenant.domain);

  return {
    tenant,
    injector,
  };
}
