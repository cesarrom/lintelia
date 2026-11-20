import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function connectorUrls(): Record<string, string> {
  const ports = JSON.parse(readFileSync(join(import.meta.dirname, '../../../dev/ports.json'), 'utf8')).services as Record<string, { port: number; url?: string }>;
  return Object.fromEntries(Object.entries(ports).filter(([name]) => name.startsWith('connector-')).map(([name, service]) => {
    const id = name.slice('connector-'.length);
    return [id, process.env[`E2E_CONNECTOR_${id.toUpperCase().replace(/-/g, '_')}_URL`] ?? service.url ?? `http://localhost:${service.port}`];
  }));
}

/**
 * Where the stack under test lives. Defaults match the local development setup (readme.md);
 * override with E2E_* variables to point the suite at another environment.
 */
export const env = {
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:8000',
  webUrl: process.env.E2E_WEB_URL ?? 'http://localhost:3001',
  /** Tenants are served on <tenant>.<baseDomain>. */
  baseDomain: process.env.E2E_BASE_DOMAIN ?? 'localhost:3001',
  restateIngressUrl: process.env.E2E_RESTATE_INGRESS_URL ?? 'http://localhost:8080',
  restateAdminUrl: process.env.E2E_RESTATE_ADMIN_URL ?? 'http://localhost:9070',
  /** Local mailbox (fake-services/mailbox): every e-mail the stack sends. */
  mailboxUrl: process.env.E2E_MAILBOX_URL ?? 'http://localhost:8025',
  /** Owner connection: only for environment setup and white-box security assertions (e.g. secrets at rest). */
  ownerDatabaseUrl: process.env.E2E_DATABASE_OWNER_URL ?? 'postgres://postgres:postgres@localhost:5433/lintelia',
  staff: {
    email: process.env.E2E_STAFF_EMAIL ?? 'staff@lintelia.local',
    password: process.env.SEED_PASSWORD ?? 'lintelia-dev-password',
    /** Second factor of the seeded staff account (development secret, apps/core/scripts/seed.ts). */
    totpSecret: process.env.E2E_STAFF_TOTP_SECRET ?? 'LINTELIADEVSTAFFSECRETAAAAAAAAAA',
  },
  /** Connector services of the local stack (integrations/*), from dev/ports.json; E2E_CONNECTOR_<ID>_URL overrides. */
  connectors: connectorUrls(),
  /** Local fakes of external systems (see docs/testing/e2e.md). Most do not exist yet. */
  fakes: {
    oidcIdp: process.env.E2E_FAKE_OIDC_URL ?? 'http://localhost:9400',
    workos: process.env.E2E_FAKE_WORKOS_URL ?? 'http://localhost:9300',
    dns: process.env.E2E_FAKE_DNS_URL ?? 'http://localhost:9408',
    didit: process.env.E2E_FAKE_DIDIT_URL ?? 'http://localhost:9401',
    documenso: process.env.E2E_FAKE_DOCUMENSO_URL ?? 'http://localhost:9402',
    coreBankingApi: process.env.E2E_FAKE_CORE_BANKING_URL ?? 'http://localhost:9403',
    webhookReceiver: process.env.E2E_FAKE_WEBHOOK_RECEIVER_URL ?? 'http://localhost:9404',
    smtp: process.env.E2E_FAKE_SMTP_URL ?? 'http://localhost:9405',
    sms: process.env.E2E_FAKE_SMS_URL ?? 'http://localhost:9406',
    screening: process.env.E2E_FAKE_SCREENING_URL ?? 'http://localhost:9407',
    scanner: process.env.E2E_FAKE_SCANNER_URL ?? 'http://localhost:9501',
    sanitizer: process.env.E2E_FAKE_SANITIZER_URL ?? 'http://localhost:9502',
    llm: process.env.E2E_FAKE_LLM_URL ?? 'http://localhost:9409',
    loanpro: process.env.E2E_FAKE_LOANPRO_URL ?? 'http://localhost:9410',
    quickbooks: process.env.E2E_FAKE_QUICKBOOKS_URL ?? 'http://localhost:9411',
    sheets: process.env.E2E_FAKE_SHEETS_URL ?? 'http://localhost:9412',
  },
  /** External database a tenant connects as a data source (created by global setup). */
  externalDatabase: {
    host: 'localhost',
    port: 5433,
    database: 'fi_core_banking',
    user: 'core_banking_reader',
    password: 'core-banking-reader-pw',
  },
};

export const tenantHost = (tenantKey: string) => `${tenantKey}.${env.baseDomain}`;
export const tenantUrl = (tenantKey: string, path = '/') => `${new URL(env.webUrl).protocol}//${tenantHost(tenantKey)}${path}`;
