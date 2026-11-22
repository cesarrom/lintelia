import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Context } from 'hono';
import { sql } from 'drizzle-orm';
import { Public } from '../auth/access';
import { PLATFORM_CONNECTION } from '../injector/tokens/platform-connection.token';
import type { PlatformDatabase } from '../clients/database.client';
import { json } from '../http/respond';

/** Liveness/readiness: the API is up and can reach the database. Used by the e2e harness and deployments. */
@Public()
@Controller({ path: '/health' })
export class HealthHandler {
  constructor(@Inject(PLATFORM_CONNECTION) private readonly db: PlatformDatabase) { }

  @Get()
  async health(@Res() ctx: Context) {
    try {
      await this.db.execute(sql`select 1`);
      json(ctx, { status: 'ok' });
    } catch (error) {
      json(ctx, { status: 'error', error: (error as Error).message }, 503);
    }
  }
}
