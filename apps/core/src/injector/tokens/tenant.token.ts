import type { AuthContext } from "../../auth/auth-context";
import { AUTH_CONTEXT } from "./auth-context.token";

/**
 * Tenant of the current request. For members and clients it is the tenant their token was issued for; for anonymous
 * requests (sign-in, registration) it is the tenant named by the `x-tenant` header. Staff requests have none.
 */
export const TENANT = Symbol.for("TENANT");
export const TENANT_PROVIDER = {
  provide: TENANT,
  inject: [AUTH_CONTEXT],
  useFactory: (auth: AuthContext) => auth.tenant,
};
