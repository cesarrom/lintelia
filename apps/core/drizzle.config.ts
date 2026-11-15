import { defineConfig } from 'drizzle-kit';

/**
 * One database for everything (platform + every tenant). Schema lives in `packages/fintivio/src/entities`.
 * Generate migrations with `bun run db:generate`; apply them with `bun run db:migrate` (runs as the owner role).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: ['../../packages/fintivio/src/entities/global/index.ts', '../../packages/fintivio/src/entities/tenant/index.ts'],
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_OWNER_URL ?? 'postgres://postgres:postgres@localhost:5433/fintivio',
  },
  strict: true,
  verbose: true,
});
