'use server';

import { getInjector } from "@/lib/injector";
import { session } from "@descope/nextjs-sdk/server";
import { auth } from "@/lib/clients/auth.client";
import { getTenant } from "@/lib/tenants";

const promiseResultOrNull = <T>(promise: Promise<T>): Promise<T | null> => promise.catch((e) => {
  console.error(e);
  return null;
});

export const getUser = async (id?: string) => {
  const s = session();
  const user = await auth.management.user.loadByUserId(id || s?.token?.sub || '');

  return user?.data || null;
}

export const getContextualInjector = async (domain?: string) => {
  const tenant = await promiseResultOrNull(getTenant(domain));
  const injector = await getInjector(tenant?.domain);
  const user = await promiseResultOrNull(getUser());

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