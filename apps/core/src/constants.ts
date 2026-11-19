import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as envVar from 'env-var';

// apps/core/.env (when run from apps/core) falls back to the repository root .env.
for (const candidate of [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
}

const e = envVar.from(process.env);

/**
 * Only what the process needs to boot is required. Vendor integrations are optional: when their settings are
 * missing the local provider is used (see `src/providers`) or the feature reports itself as not configured.
 */
export const env = {
  NODE_ENV: e.get('NODE_ENV').default('local').asString(),
  PORT: e.get('PORT').default('8000').asPortNumber(),
  /** Public base URL of this API, e.g. http://localhost:8000. Restate calls `${HOST}/restate`. */
  HOST: e.get('HOST').default('http://localhost:8000').asUrlString(),
  /** Base domain tenants hang off (tenant `acme` -> `acme.${BASE_DOMAIN}`). */
  BASE_DOMAIN: e.get('BASE_DOMAIN').default('localhost:3001').asString(),
  /** Public URL of the web app, used in e-mails (invitation links). */
  WEB_URL: e.get('WEB_URL').default('http://localhost:3001').asUrlString(),
  /** Extra browser origins allowed besides WEB_URL, tenant sub-domains and tenant custom domains. */
  CORS_ORIGINS: e.get('CORS_ORIGINS').default('').asArray(',') ?? [],

  // Database: one Postgres. The app never connects as owner/superuser (row level security would be bypassed).
  DATABASE_URL: e.get('DATABASE_URL').required().asString(),
  DATABASE_PLATFORM_URL: e.get('DATABASE_PLATFORM_URL').required().asString(),

  // Auth (local provider)
  AUTH_JWT_SECRET: e.get('AUTH_JWT_SECRET').required().asString(),
  /** Access token lifetime (seconds). Sessions continue through rotating refresh tokens. */
  AUTH_ACCESS_TTL_SECONDS: e.get('AUTH_ACCESS_TTL_SECONDS').default('900').asIntPositive(),
  /** Session (refresh) lifetime (seconds). */
  AUTH_SESSION_TTL_SECONDS: e.get('AUTH_SESSION_TTL_SECONDS').default(String(12 * 3600)).asIntPositive(),
  AUTH_JWT_ISSUER: e.get('AUTH_JWT_ISSUER').default('fintivio').asString(),

  // SSO broker (docs/plans/02): WorkOS. Locally the WorkOS emulator (fake-services/workos) with the same SDK.
  WORKOS_API_KEY: e.get('WORKOS_API_KEY').default('sk_test_local_emulator').asString(),
  WORKOS_CLIENT_ID: e.get('WORKOS_CLIENT_ID').default('client_local_emulator').asString(),
  WORKOS_API_HOSTNAME: e.get('WORKOS_API_HOSTNAME').default('localhost').asString(),
  WORKOS_HTTPS: e.get('WORKOS_HTTPS').default('false').asBool(),
  WORKOS_PORT: e.get('WORKOS_PORT').default('9300').asPortNumber(),

  /** How often directory sync polls the broker's events (seconds; 0 = off). */
  DIRECTORY_SYNC_INTERVAL_SECONDS: e.get('DIRECTORY_SYNC_INTERVAL_SECONDS').default(process.env.NODE_ENV === 'production' ? '60' : '3').asInt(),
  /** How often scheduled access changes are applied and stale approvals expire (seconds; 0 = off). */
  /** Live updates (docs/plans/17): keep-alive comment on open streams, and how often their session is checked again. */
  LIVE_HEARTBEAT_MS: e.get('LIVE_HEARTBEAT_MS').default(process.env.NODE_ENV === 'production' ? '20000' : '5000').asInt(),
  LIVE_REVALIDATE_MS: e.get('LIVE_REVALIDATE_MS').default(process.env.NODE_ENV === 'production' ? '30000' : '3000').asInt(),
  LIVE_MAX_STREAMS_PER_USER: e.get('LIVE_MAX_STREAMS_PER_USER').default('20').asInt(),
  ACCESS_CHANGES_INTERVAL_SECONDS: e.get('ACCESS_CHANGES_INTERVAL_SECONDS').default(process.env.NODE_ENV === 'production' ? '30' : '2').asInt(),
  /** Staff accounts that keep password + TOTP when staff SSO is enforced (break-glass; alert on use). */
  STAFF_BREAK_GLASS_EMAILS: (e.get('STAFF_BREAK_GLASS_EMAILS').default('staff@fintivio.local').asArray(',') ?? []).map((x) => x.trim().toLowerCase()),

  // Redis: sessions, one-time codes, rate limits
  REDIS_URL: e.get('REDIS_URL').default('redis://localhost:6380').asUrlString(),

  // Restate
  RESTATE_ENDPOINT: e.get('RESTATE_ENDPOINT').default('http://localhost:8080').asUrlString(),
  RESTATE_ADMIN_ENDPOINT: e.get('RESTATE_ADMIN_ENDPOINT').default('http://localhost:9070').asUrlString(),
  /** Restate request-signing public keys (`publickeyv1_...`). When set, unsigned requests to /restate are rejected. */
  RESTATE_IDENTITY_KEYS: (e.get('RESTATE_IDENTITY_KEYS').asArray(',') ?? []).map((k) => k.trim()).filter(Boolean),
  /** Register this deployment with the Restate admin API on startup. */
  RESTATE_AUTO_REGISTER: e.get('RESTATE_AUTO_REGISTER').default('true').asBool(),

  // API clients (docs/plans/04): requests per minute per client and per institution.
  API_CLIENT_RATE_LIMIT: e.get('API_CLIENT_RATE_LIMIT').default('600').asIntPositive(),
  API_TENANT_RATE_LIMIT: e.get('API_TENANT_RATE_LIMIT').default('3000').asIntPositive(),

  // Outbound webhooks (docs/plans/04): retry schedule in seconds between attempts, and how long a subscription may
  // fail before it is disabled.
  WEBHOOK_RETRY_SCHEDULE: (e.get('WEBHOOK_RETRY_SCHEDULE').default('5,30,120,600,1800,7200,18000,36000').asArray(',') ?? []).map(Number).filter((n) => n > 0),
  WEBHOOK_DISABLE_AFTER_SECONDS: e.get('WEBHOOK_DISABLE_AFTER_SECONDS').default(String(24 * 3600)).asIntPositive(),
  /** Allow webhook URLs on private networks / localhost (local development only). */
  WEBHOOK_ALLOW_PRIVATE_URLS: e.get('WEBHOOK_ALLOW_PRIVATE_URLS').default(process.env.NODE_ENV === 'production' ? 'false' : 'true').asBool(),

  // E-mail. EMAIL_PROVIDER=outbox writes messages to EMAIL_OUTBOX_DIR instead of sending them.
  EMAIL_PROVIDER: e.get('EMAIL_PROVIDER').default('outbox').asEnum(['outbox', 'smtp']),
  EMAIL_OUTBOX_DIR: e.get('EMAIL_OUTBOX_DIR').default('.data/outbox').asString(),
  /** Local signing keys (development); deployed environments set CORE_SIGNING_JWK. */
  KEYS_DIR: e.get('KEYS_DIR').default('.data/keys').asString(),
  EMAIL_FROM: e.get('EMAIL_FROM').default('Fintivio <no-reply@fintivio.local>').asString(),
  SMTP_HOST: e.get('SMTP_HOST').asString(),
  SMTP_PORT: e.get('SMTP_PORT').asPortNumber(),
  SMTP_SECURE: e.get('SMTP_SECURE').default('false').asBool(),
  SMTP_USER: e.get('SMTP_USER').asString(),
  SMTP_PASS: e.get('SMTP_PASS').asString(),

  // File storage. STORAGE_PROVIDER=local keeps files under STORAGE_LOCAL_DIR and serves them from /files.
  STORAGE_PROVIDER: e.get('STORAGE_PROVIDER').default('local').asEnum(['local']),
  STORAGE_LOCAL_DIR: e.get('STORAGE_LOCAL_DIR').default('.data/files').asString(),

  // Uploads (docs/plans/07): object store (local adapter: a directory), malware scanner and content sanitiser.
  OBJECT_STORE_DIR: e.get('OBJECT_STORE_DIR').default('.data/objects').asString(),
  SCANNER_URL: e.get('SCANNER_URL').default('http://localhost:9501').asUrlString(),
  SANITIZER_URL: e.get('SANITIZER_URL').default('http://localhost:9502').asUrlString(),

  // DNS lookups for custom domain verification: `system` (real DNS) or `http` (a DNS-over-HTTPS JSON endpoint; locally
  // fake-services/dns).
  DNS_RESOLVER: e.get('DNS_RESOLVER').default(process.env.NODE_ENV === 'production' ? 'system' : 'http').asEnum(['system', 'http']),
  DNS_HTTP_URL: e.get('DNS_HTTP_URL').default('http://localhost:9408/resolve').asUrlString(),
  /** Where institutions point their custom host names (CNAME target of the edge). */
  CUSTOM_DOMAIN_TARGET: e.get('CUSTOM_DOMAIN_TARGET').default('custom.fintivio.local').asString(),

  // Vendors without a local fake yet: features using them fail with a clear "not configured" error.
  OPENAI_API_KEY: e.get('OPENAI_API_KEY').asString(),
};

export type AppEnvironment = typeof env;

/** Public URL of the web app for a tenant: `${protocol}//${tenant}.${BASE_DOMAIN}${path}`. */
export const tenantWebUrl = (tenantDomain: string, path: string) => {
  const { protocol } = new URL(env.WEB_URL);
  return `${protocol}//${tenantDomain}.${env.BASE_DOMAIN}${path.startsWith('/') ? path : `/${path}`}`;
};

export class NotConfiguredError extends Error {
  constructor(feature: string, variables: string[]) {
    super(`${feature} is not configured (set ${variables.join(', ')})`);
    this.name = 'NotConfiguredError';
  }
}
