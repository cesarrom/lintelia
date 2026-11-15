import type { AuthContext } from "../../auth/auth-context";
import { AUTH_CONTEXT } from "./auth-context.token";

/** The authenticated user of the current request, or null. */
export const USER = Symbol.for("USER");
export const USER_PROVIDER = {
  provide: USER,
  inject: [AUTH_CONTEXT],
  useFactory: (auth: AuthContext) => auth.user,
};
