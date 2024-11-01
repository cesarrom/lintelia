"use server";

import React from "react";
import { TenantProvider } from "./tenant.provider";
import { getTenant } from "@/actions/tenants";

export async function TenantFetcher({ children }: React.PropsWithChildren<unknown>) {
  const tenant = await getTenant();

  return (
    <TenantProvider tenant={tenant}>
      {children}
    </TenantProvider>
  );
}