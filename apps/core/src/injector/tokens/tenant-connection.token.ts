import type { Tenant } from "@repo/fintivio/schemas";
import { ConnectionService } from "../../services/connection.service";
import { TENANT } from "./tenant.token";


export const TENANT_CONNECTION = Symbol.for("TENANT_CONNECTION");
export const TENANT_CONNECTION_PROVIDER = {
  provide: TENANT_CONNECTION,
  inject: [ConnectionService, TENANT],
  useFactory: async (dbService: ConnectionService, tenant: Tenant) => {
    if (!tenant || !tenant.databaseUrl || !tenant.domain) return null;

    return dbService.getTenantConnection(tenant.domain, tenant.databaseUrl);
  }
};