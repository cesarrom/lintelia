import { EventEmitter } from 'node:events';
import { RequestMethod, type VersioningOptions } from '@nestjs/common';
import type { VersionValue } from '@nestjs/common/interfaces';
import type { NestApplicationOptions } from '@nestjs/common/interfaces/nest-application-options.interface';
import { AbstractHttpAdapter } from '@nestjs/core';
import { Hono, type Context } from 'hono';
import type { HonoRequest } from 'hono/request';

/**
 * NestJS HTTP adapter for Hono served by Bun.
 *
 * Replaces `@kiyasov/platform-hono`, which is no longer available from the npm registry. It only implements what the
 * application uses: controllers receive the `HonoRequest` as the request object (`@Req()`) and the Hono `Context` as
 * the response object (`@Res()`), and may either set `ctx.res` themselves or return a value (sent as JSON).
 * Route params are exposed on `req.params` for `@Param()`.
 */

type Handler = (req: any, res: any, next?: (err?: unknown) => void) => unknown;

/** Minimal EventEmitter-based server handle, which is what Nest expects from `getHttpServer()`. */
export class BunHttpServer extends EventEmitter {
  server?: ReturnType<typeof Bun.serve>;

  address() {
    if (!this.server) return null;
    return { address: this.server.hostname ?? '0.0.0.0', family: 'IPv4', port: this.server.port };
  }
}

const pendingStatus = new WeakMap<Context, number>();

export class HonoAdapter extends AbstractHttpAdapter<BunHttpServer, HonoRequest, Context> {
  protected declare instance: Hono;

  constructor(instance: Hono = new Hono({ strict: false })) {
    super(instance);
  }

  getInstance<T = Hono>(): T {
    return this.instance as T;
  }

  // --- routing ---------------------------------------------------------------------------------------------------

  private route(method: string, pathOrHandler: string | Handler, maybeHandler?: Handler) {
    const [path, handler] = typeof pathOrHandler === 'function' ? ['*', pathOrHandler] : [pathOrHandler || '/', maybeHandler!];
    const methods = method === 'ALL' ? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] : [method];
    this.instance.on(methods, path, async (c) => {
      const req = c.req as HonoRequest & { params?: Record<string, string> };
      req.params = c.req.param() as Record<string, string>;
      await handler(req, c, () => { });
      return c.res;
    });
  }

  get(pathOrHandler: any, handler?: any) { return this.route('GET', pathOrHandler, handler); }
  post(pathOrHandler: any, handler?: any) { return this.route('POST', pathOrHandler, handler); }
  put(pathOrHandler: any, handler?: any) { return this.route('PUT', pathOrHandler, handler); }
  patch(pathOrHandler: any, handler?: any) { return this.route('PATCH', pathOrHandler, handler); }
  delete(pathOrHandler: any, handler?: any) { return this.route('DELETE', pathOrHandler, handler); }
  head(pathOrHandler: any, handler?: any) { return this.route('HEAD', pathOrHandler, handler); }
  options(pathOrHandler: any, handler?: any) { return this.route('OPTIONS', pathOrHandler, handler); }
  search(pathOrHandler: any, handler?: any) { return this.route('SEARCH', pathOrHandler, handler); }
  all(pathOrHandler: any, handler?: any) { return this.route('ALL', pathOrHandler, handler); }

  use(...args: any[]) {
    return (this.instance.use as any)(...args);
  }

  createMiddlewareFactory(requestMethod: RequestMethod) {
    return (path: string, callback: Function) => {
      const method = RequestMethod[requestMethod];
      this.instance.use(path, async (c, next) => {
        if (method !== 'ALL' && c.req.method !== method) return next();
        let calledNext = false;
        await new Promise<void>((resolve, reject) => {
          Promise.resolve(callback(c.req, c, (err?: unknown) => {
            calledNext = true;
            err ? reject(err) : resolve();
          })).then(() => { if (!calledNext) resolve(); }, reject);
        });
        if (calledNext) await next();
      });
    };
  }

  setNotFoundHandler(handler: Function) {
    this.instance.notFound(async (c) => {
      await handler(c.req, c, () => { });
      return c.res;
    });
  }

  setErrorHandler(handler: Function) {
    this.instance.onError(async (err, c) => {
      await handler(err, c.req, c, () => { });
      return c.res;
    });
  }

  applyVersionFilter(handler: Function, _version: VersionValue, _options: VersioningOptions) {
    return handler as any;
  }

  // --- responses -------------------------------------------------------------------------------------------------

  reply(c: Context, body: any, statusCode?: number) {
    const status = statusCode ?? pendingStatus.get(c) ?? 200;
    if (body instanceof Response) {
      c.res = body;
    } else if (body === undefined || body === null) {
      c.res = new Response(null, { status });
    } else if (typeof body === 'object' && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array) && !(body instanceof Blob) && !(body instanceof ReadableStream)) {
      c.res = new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    } else {
      c.res = new Response(body, { status });
    }
    return c.res;
  }

  status(c: Context, statusCode: number) {
    pendingStatus.set(c, statusCode);
  }

  end(c: Context, message?: string) {
    c.res = new Response(message ?? null, { status: pendingStatus.get(c) ?? 200 });
  }

  redirect(c: Context, statusCode: number, url: string) {
    c.res = new Response(null, { status: statusCode, headers: { location: url } });
  }

  isHeadersSent(c: Context) {
    return c.finalized;
  }

  getHeader(c: Context, name: string) {
    return c.res.headers.get(name);
  }

  setHeader(c: Context, name: string, value: string) {
    c.header(name, value);
  }

  appendHeader(c: Context, name: string, value: string) {
    c.header(name, value, { append: true });
  }

  render() {
    throw new Error('View rendering is not supported by the Hono adapter');
  }

  setViewEngine() {
    throw new Error('View engines are not supported by the Hono adapter');
  }

  useStaticAssets() {
    throw new Error('Static assets are not supported by the Hono adapter');
  }

  // --- requests --------------------------------------------------------------------------------------------------

  getRequestHostname(req: HonoRequest) {
    return new URL(req.url).hostname;
  }

  getRequestMethod(req: HonoRequest) {
    return req.method;
  }

  getRequestUrl(req: HonoRequest) {
    const url = new URL(req.url);
    return url.pathname + url.search;
  }

  registerParserMiddleware() {
    // Bodies are read on demand through HonoRequest (json()/text()/formData() are cached and can be read repeatedly).
  }

  enableCors() {
    throw new Error('Use hono/cors on the Hono instance (see main.ts) instead of app.enableCors()');
  }

  // --- server lifecycle ------------------------------------------------------------------------------------------

  initHttpServer(_options: NestApplicationOptions) {
    this.httpServer = new BunHttpServer();
  }

  listen(port: string | number, ...args: any[]) {
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
    const hostname = typeof args[0] === 'string' ? args[0] : undefined;
    try {
      this.httpServer.server = Bun.serve({
        port: Number(port),
        hostname,
        // Restate keeps invocation requests open while a handler runs; Bun's default idle timeout is 10 seconds.
        idleTimeout: 255,
        fetch: (request, server) => this.instance.fetch(request, { server }),
      });
      callback?.();
    } catch (error) {
      if (callback) callback(error);
      else this.httpServer.emit('error', error);
    }
    return this.httpServer;
  }

  close() {
    this.httpServer?.server?.stop(true);
  }

  getType() {
    return 'hono';
  }
}
