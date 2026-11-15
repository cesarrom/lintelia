import type { Tenant } from "@repo/fintivio/schemas";
import type { Databases } from "../../clients/database.client";
import { DATABASES } from "./databases.token";
import { TENANT } from "./tenant.token";

/**
 * Tenant-scoped connection for the current request: `fintivio_app` with `app.tenant_id` set on every transaction, so
 * row level security limits it to the tenant of the authenticated principal. Null when the request has no tenant.
 */
export const TENANT_CONNECTION = Symbol.for("TENANT_CONNECTION");
export const TENANT_CONNECTION_PROVIDER = {
  provide: TENANT_CONNECTION,
  inject: [DATABASES, TENANT],
  useFactory: (databases: Databases, tenant: Tenant | null) => (tenant ? databases.forTenant(tenant.id) : null),
};
