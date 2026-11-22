import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { Hono } from 'hono';
import { AppModule } from './app.module';
import { env } from './constants';
import { HonoAdapter } from './http/hono-adapter';
import { IdentityService } from './auth/identity.service';
import { TenantDirectory } from './services/tenant-directory.service';
import { corsMiddleware } from './http/cors';
import { machineTraffic } from './http/machine-traffic';
import { redis } from './clients/redis.client';
import { liveTicketKey } from './handlers/live.controller';

/** Register (or refresh) this deployment with the Restate server so it can invoke the handlers at /restate. */
async function registerWithRestate() {
  const uri = new URL('/restate', env.HOST).toString();
  try {
    const response = await fetch(new URL('/deployments', env.RESTATE_ADMIN_ENDPOINT), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uri, force: true, use_http_11: true }),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const { services = [] } = await response.json() as { services?: Array<{ name: string }> };
    console.log(`\x1b[32mRegistered ${uri} with Restate (${services.length} services)\x1b[0m`);
  } catch (error) {
    console.warn(`\x1b[33mCould not register ${uri} with Restate at ${env.RESTATE_ADMIN_ENDPOINT}: ${(error as Error).message}\x1b[0m`);
    console.warn('Start it with `bun run restate:serve`, then `bun run restate:register` (or restart the API).');
  }
}

async function bootstrap() {
  const adapter = new HonoAdapter();
  const hono = adapter.getInstance<Hono>();
  const app = await NestFactory.create(AppModule, adapter, { logger: ['error', 'warn'] });
  const identity = app.get(IdentityService);

  // Registered before Nest adds its routes (on init), so these run first for every request.
  hono.use(corsMiddleware(app.get(TenantDirectory)));
  hono.use(async (c, next) => {
    const started = performance.now();
    // Restate invocations authenticate per invocation (see RestateHandler); everything else is resolved here.
    if (!c.req.path.startsWith('/restate')) {
      // Live streams opened with EventSource (no headers) carry a single-use ticket instead (docs/plans/17 §4.5).
      const ticket = c.req.path === '/live' ? c.req.query('ticket') : undefined;
      const held = ticket ? await redis().send('GETDEL', [liveTicketKey(ticket)]).catch(() => null) : null;
      const fallback = held ? JSON.parse(String(held)) as { token?: string; tenant?: string } : {};
      (c.req as any).auth = await identity.resolve(c.req.raw.headers, fallback);
    }
    await next();
    if (!c.req.path.startsWith('/restate') || env.NODE_ENV !== 'local') {
      console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${(performance.now() - started).toFixed(0)}ms`);
    }
  });

  // API clients: rate limits and Idempotency-Key (after identity resolution).
  hono.use(machineTraffic());

  app.enableShutdownHooks();
  await app.listen(env.PORT);
  console.log(`\x1b[36mAPI listening on ${env.HOST} (port ${env.PORT})\x1b[0m`);

  if (env.RESTATE_AUTO_REGISTER) {
    await registerWithRestate();
  }
}

await bootstrap();
