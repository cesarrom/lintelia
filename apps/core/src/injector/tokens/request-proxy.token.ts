import { REQUEST } from '@nestjs/core'
import type { HonoRequest } from "hono/request";
import { proxyRequest } from '../../utils/request';

export type AppRequest = Omit<Request, 'copy'> & {
  copy: () => Promise<Request>
};

export const REQUEST_PROXY = Symbol.for("REQUEST_PROXY");

export const REQUEST_PROXY_PROVIDER = {
  provide: REQUEST_PROXY,
  inject: [REQUEST],
  useFactory: async (req: HonoRequest | Request) => {
    return proxyRequest(req)
  }
};
