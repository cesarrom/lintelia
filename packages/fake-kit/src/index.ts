import { Hono } from 'hono';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Building blocks of the fake services (docs/plans/08): every fake exposes `GET /__health`, a request log at
 * `GET /__control/requests`, `POST /__control/reset`, and whatever scenario controls it needs under `/__control/*`.
 * Fakes follow the real vendor contracts so connectors and adapters run unchanged against them.
 */

export interface RecordedRequest {
  id: string;
  at: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

export interface FakeService {
  app: Hono;
  name: string;
  port: number;
  /** Requests received on the vendor-facing API (not the control API). */
  requests: RecordedRequest[];
  /** Register extra state reset handlers. */
  onReset(handler: () => void): void;
  start(): ReturnType<typeof Bun.serve>;
}

const ROOT = resolve(import.meta.dir, '../../..');

/** Ports and host names of the local stack (dev/ports.json). */
export function devPort(name: string, fallback: number): number {
  const fromEnv = process.env[`${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_PORT`];
  if (fromEnv) return Number(fromEnv);
  try {
    const ports = JSON.parse(readFileSync(join(ROOT, 'dev/ports.json'), 'utf8')) as { services: Record<string, { port: number }> };
    return ports.services[name]?.port ?? fallback;
  } catch {
    return fallback;
  }
}

/** A JSON file under `.data/fake-services/<name>/` for fakes that keep state across restarts. */
export function jsonState<T>(service: string, file: string, initial: T) {
  const path = join(ROOT, '.data/fake-services', service, file);
  mkdirSync(dirname(path), { recursive: true });
  let value: T = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : initial;
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      writeFileSync(path, JSON.stringify(value, null, 2));
    },
  };
}

export function createFakeService(options: { name: string; port: number; recordPaths?: (path: string) => boolean }): FakeService {
  const app = new Hono();
  const requests: RecordedRequest[] = [];
  const resetHandlers: Array<() => void> = [];
  const record = options.recordPaths ?? ((path: string) => !path.startsWith('/__') && !path.startsWith('/assets'));

  app.use('*', async (c, next) => {
    if (record(c.req.path)) {
      const body = ['GET', 'HEAD'].includes(c.req.method) ? '' : await c.req.raw.clone().text();
      requests.push({
        id: randomUUID(), at: new Date().toISOString(), method: c.req.method, path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers.entries()), body,
      });
      if (requests.length > 1000) requests.splice(0, requests.length - 1000);
    }
    await next();
  });
  app.get('/__health', (c) => c.json({ ok: true, service: options.name }));
  app.get('/__control/requests', (c) => {
    const path = c.req.query('path');
    return c.json(path ? requests.filter((r) => r.path.startsWith(path)) : requests);
  });
  app.post('/__control/reset', (c) => {
    requests.splice(0);
    for (const handler of resetHandlers) handler();
    return c.json({ reset: true });
  });

  return {
    app, name: options.name, port: options.port, requests,
    onReset: (handler) => resetHandlers.push(handler),
    start() {
      const server = Bun.serve({ port: options.port, fetch: app.fetch, idleTimeout: 60 });
      console.log(`[${options.name}] fake listening on http://localhost:${options.port}`);
      return server;
    },
  };
}

/** Standard Webhooks signature (`webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64>`). */
export function standardWebhookHeaders(secret: string, id: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(timestamp), 'webhook-signature': `v1,${signature}` };
}

export const hmacHex = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');

/** Tiny HTML page shell shared by fakes' UIs. */
export function page(title: string, body: string, accent = '#334155') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;color:#0f172a;background:#f8fafc}
  header{background:${accent};color:#fff;padding:12px 20px;display:flex;gap:16px;align-items:center}
  header b{font-size:16px} header span{opacity:.8;font-size:13px}
  main{padding:20px;max-width:1100px;margin:auto}
  table{border-collapse:collapse;width:100%;background:#fff} td,th{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left;font-size:14px;vertical-align:top}
  a{color:#1d4ed8} button{background:${accent};color:#fff;border:0;border-radius:6px;padding:10px 16px;font-size:14px;cursor:pointer}
  button.secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1} .muted{color:#64748b;font-size:12px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px}
  pre{white-space:pre-wrap;word-break:break-word;background:#f1f5f9;padding:12px;border-radius:6px}
  input,select{padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px}
</style></head><body><header><b>${escapeHtml(title)}</b><span>local fake service</span></header><main>${body}</main></body></html>`;
}

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
