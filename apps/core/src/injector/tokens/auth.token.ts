import { auth } from "../../clients/auth.client";

export const AUTH = Symbol.for("AUTH");
export const AUTH_PROVIDER = {
  provide: AUTH,
  useValue: auth,
};
