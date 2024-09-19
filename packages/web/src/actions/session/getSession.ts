"use server";

import { getTenant } from "@/actions/tenants/getTenant";
import { headers } from "next/headers";
import { env } from "@fintivio-sst/core/constants";
import { listApplicationsByUserId } from "../users/listApplicationsByUserId";
import { getUserById } from "../users/getUserById";
import { session } from "@descope/nextjs-sdk/server";

const gs = async () => {
  const headersList = headers();
  const headerUrl = headersList.get('x-forwarded-host') || "";
  const currentSession = session();

  const userId = currentSession?.token?.sub || "";

  // {tenant}.{env?}.fintivio.org/...
  const host = new URL('https://' + env.DOMAIN);

  const origin = host.hostname.split(".")[0];
  const envs = ["dev", "stage", "www", origin];
  const tenantName = headerUrl.split(".")[0];

  console.log({
    origin,
    envs,
    tenantName,
    host
  });

  let tenant = !tenantName || envs.includes(tenantName) ? null : await getTenant();

  if (!tenant) {
    return {
      user: null,
      tenant: null,
    };
  }

  console.log('userId:', userId);

  if (!userId) {
    console.log('only tenant');
    return {
      user: null,
      tenant,
    };
  }

  const user = await getUserById(userId, tenantName);

  if (!user) {
    console.log('only tenant');

    return {
      user: null,
      tenant,
    };
  }

  const applications = await listApplicationsByUserId(userId, tenantName);
  console.log('user and tenant');

  return {
    user: {
      ...user,
      applications,
    },
    tenant,
  };
}

export type AppSession = Awaited<ReturnType<typeof gs>>;

export { gs as getSession };