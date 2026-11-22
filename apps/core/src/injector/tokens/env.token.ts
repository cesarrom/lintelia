import { env } from "../../constants";


export const ENV = Symbol.for("ENV")
export const ENV_PROVIDER = {
  provide: ENV,
  useValue: env,
};
