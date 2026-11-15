/**
 * Services of the local stack (docs/plans/08 §One command), started by `bun run stack` (scripts/stack.ts).
 *
 *  - kind `service`: long-running process, healthy when its check passes; restarted if it crashes.
 *  - kind `task`: runs once (migrations, seed, registrations) after its dependencies are healthy.
 *  - `profiles`: `core` (what the back office needs), `full` (+ fake vendors, connectors, demo site), `e2e` (= full).
 * Ports come from dev/ports.json.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ports from './ports.json';

export type Check =
  | { type: 'http'; url: string }
  | { type: 'tcp'; port: number }
  | { type: 'log'; pattern: RegExp; port?: number };

export interface StackEntry {
  name: string;
  kind: 'service' | 'task';
  description: string;
  cwd: string;
  command: string[];
  env?: Record<string, string>;
  dependsOn?: string[];
  check?: Check;
  profiles: Array<'core' | 'full' | 'e2e'>;
  /** Shown in the summary table. */
  url?: string;
  label?: string;
  /** Seconds to wait for health before giving up. */
  timeout?: number;
}

const p = ports.services as Record<string, { port: number; url?: string }>;

/** Connectors of this repository (integrations/<dir>/package.json with `fintivio.connector`). */
function connectors() {
  const dir = join(import.meta.dir, '../integrations');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name, 'package.json');
    if (!existsSync(file)) return [];
    const id = JSON.parse(readFileSync(file, 'utf8')).fintivio?.connector as string | undefined;
    const service = id ? p[`connector-${id}`] : undefined;
    return id && service ? [{ id, cwd: `integrations/${name}`, port: service.port, url: service.url ?? `http://localhost:${service.port}` }] : [];
  });
}
const all: StackEntry['profiles'] = ['core', 'full', 'e2e'];
const full: StackEntry['profiles'] = ['full', 'e2e'];

export const stack: StackEntry[] = [
  {
    name: 'postgres', kind: 'service', description: 'embedded Postgres 17 (creates, migrates and seeds on first run)',
    cwd: 'apps/core', command: ['bun', './scripts/db.ts', 'start'],
    check: { type: 'log', pattern: /ready: /, port: p.postgres.port }, profiles: all, timeout: 180,
  },
  {
    name: 'redis', kind: 'service', description: 'Redis (sessions, one-time codes, rate limits)',
    cwd: 'apps/core', command: ['bun', './scripts/redis.ts', 'start'],
    check: { type: 'tcp', port: p.redis.port }, profiles: all, timeout: 180,
  },
  {
    name: 'restate', kind: 'service', description: 'Restate server (durable execution)',
    cwd: 'apps/core', command: ['bun', './scripts/restate.ts', 'serve'],
    check: { type: 'http', url: `http://localhost:${p['restate-admin'].port}/health` }, profiles: all, timeout: 120,
  },
  {
    name: 'mailbox', kind: 'service', description: 'local mailbox: SMTP :1025 + web inbox',
    cwd: 'fake-services/mailbox', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.mailbox.url}/__health` }, profiles: all, url: p.mailbox.url, label: 'Mailbox (all e-mails)',
  },
  {
    name: 'webhook-receiver', kind: 'service', description: 'local webhook endpoints (records and verifies deliveries)',
    cwd: 'fake-services/webhook-receiver', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p['webhook-receiver'].url}/__health` }, profiles: full, url: p['webhook-receiver'].url, label: 'Webhook receiver',
  },
  {
    name: 'scanner', kind: 'service', description: 'malware scanner fake (flags EICAR)',
    cwd: 'fake-services/scanner', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.scanner.url}/__health` }, profiles: all, url: p.scanner.url, label: 'Malware scanner (fake)',
  },
  {
    name: 'sanitizer', kind: 'service', description: 'content sanitiser fake (PDF rebuild, image metadata removal)',
    cwd: 'fake-services/sanitizer', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.sanitizer.url}/__health` }, profiles: all, url: p.sanitizer.url, label: 'Sanitiser (fake)',
  },
  {
    name: 'didit', kind: 'service', description: 'Didit fake (sessions, hosted verification page, signed webhooks)',
    cwd: 'fake-services/didit', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.didit.url}/__health` }, profiles: full, url: p.didit.url, label: 'Didit (fake)',
  },
  {
    name: 'documenso', kind: 'service', description: 'Documenso fake (v2 API subset, signing page, webhooks)',
    cwd: 'fake-services/documenso', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.documenso.url}/__health` }, profiles: full, url: p.documenso.url, label: 'Documenso (fake)',
  },
  {
    name: 'idp-oidc', kind: 'service', description: 'fake workforce IdP (OpenID Connect: Okta/Entra/Google stand-in)',
    cwd: 'fake-services/idp-oidc', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p['idp-oidc'].url}/__health` }, profiles: all, url: p['idp-oidc'].url, label: 'Identity provider (fake)',
  },
  {
    name: 'workos', kind: 'service', description: 'WorkOS emulator (SSO broker: organizations, Admin Portal, SSO)',
    cwd: 'fake-services/workos', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.workos.url}/__health` }, profiles: all, url: p.workos.url, label: 'WorkOS (emulator)',
  },
  {
    name: 'dns', kind: 'service', description: 'local DNS zone for verification records (custom domains)',
    cwd: 'fake-services/dns', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.dns.url}/__health` }, profiles: all, url: p.dns.url, label: 'DNS (fake)',
  },
  {
    name: 'screening', kind: 'service', description: 'screening vendor fake (sanctions, PEP, adverse media)',
    cwd: 'fake-services/screening', command: ['bun', 'src/index.ts'],
    check: { type: 'http', url: `${p.screening.url}/__health` }, profiles: full, url: p.screening.url, label: 'Screening (fake)',
  },
  {
    name: 'migrate', kind: 'task', description: 'database migrations (dev + test databases)',
    cwd: 'apps/core', command: ['bun', './scripts/db.ts', 'migrate'], dependsOn: ['postgres'], profiles: all,
  },
  {
    name: 'seed', kind: 'task', description: 'development data (idempotent)',
    cwd: 'apps/core', command: ['bun', './scripts/db.ts', 'seed'], dependsOn: ['migrate'], profiles: all,
  },
  {
    name: 'package', kind: 'service', description: 'shared package @repo/fintivio (build + watch)',
    cwd: 'packages/fintivio', command: ['bun', 'run', 'dev'],
    check: { type: 'log', pattern: /Build success/ }, profiles: all, timeout: 300,
  },
  {
    name: 'api', kind: 'service', description: 'API (NestJS on Hono, Bun, watch mode); registers with Restate',
    cwd: 'apps/core', command: ['bun', '--watch', './src/main.ts'],
    dependsOn: ['seed', 'redis', 'restate', 'mailbox', 'package', 'scanner', 'sanitizer', 'workos'],
    check: { type: 'http', url: `${p.api.url}/health` }, profiles: all, url: p.api.url, timeout: 120,
  },
  {
    name: 'web', kind: 'service', description: 'web app (Vite)',
    cwd: 'apps/web', command: ['bun', 'run', 'dev'], dependsOn: ['package'],
    check: { type: 'http', url: p.web.url }, profiles: all, url: p.web.url, timeout: 180,
  },
  {
    name: 'connector-databases', kind: 'task', description: "a database + role per connector (connectors never share the core's)",
    cwd: 'apps/core', command: ['bun', './scripts/connectors.ts', 'databases'], dependsOn: ['migrate'], profiles: full,
  },
  ...connectors().map((c): StackEntry => ({
    name: `connector-${c.id}`, kind: 'service', description: `connector ${c.id} (own database connector_${c.id.replace(/-/g, '_')})`,
    cwd: c.cwd, command: ['bun', '--watch', 'src/index.ts'], dependsOn: ['connector-databases', 'package'],
    check: { type: 'http', url: `${c.url}/health` }, profiles: full, url: c.url, label: `Connector ${c.id}`,
  })),
  {
    name: 'register-connectors', kind: 'task', description: 'register + approve local connector manifests (what staff do in Platform → Connectors)',
    cwd: 'apps/core', command: ['bun', './scripts/connectors.ts', 'register'],
    dependsOn: ['migrate', ...connectors().map((c) => `connector-${c.id}`)], profiles: full,
  },
  {
    name: 'demo-site', kind: 'service', description: "Demo Bank's public website with the loan form embedded",
    cwd: 'apps/core', command: ['bun', './scripts/demo-site.ts'],
    check: { type: 'http', url: p['demo-site'].url }, profiles: full, url: p['demo-site'].url, label: 'Bank website (embed)',
  },
];
