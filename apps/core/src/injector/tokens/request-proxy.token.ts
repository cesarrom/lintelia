import { REQUEST } from '@nestjs/core';
import type { HonoRequest } from "hono/request";

/**
 * Uniform access to the current request for services and controllers. HTTP requests wrap the HonoRequest (whose body
 * readers are cached, so the body can be read several times); Restate invocations provide a synthetic request built
 * from the invocation headers and input (see RestateHandler).
 */
export interface AppRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  json<T = any>(): Promise<T>;
  text(): Promise<string>;
  formData(): Promise<FormData>;
}

export const REQUEST_PROXY = Symbol.for("REQUEST_PROXY");

const isHonoRequest = (req: unknown): req is HonoRequest => !!req && typeof req === 'object' && 'raw' in req;

export const fromHonoRequest = (req: HonoRequest): AppRequest => ({
  url: req.url,
  method: req.method,
  headers: req.raw.headers,
  json: () => req.json(),
  text: () => req.text(),
  formData: () => req.formData(),
});

export const REQUEST_PROXY_PROVIDER = {
  provide: REQUEST_PROXY,
  inject: [REQUEST],
  useFactory: (req: HonoRequest | AppRequest): AppRequest => (isHonoRequest(req) ? fromHonoRequest(req) : req),
};
