/**
 * Demo Auto Finance (docs/plans/12), ready to click through after `bun run stack`:
 *  - connections to the local fakes, made like an administrator does (the connector's own settings page):
 *    AI (fake language model), LoanPro, Documenso, and two "HTTP API" connections (Google Sheets, QuickBooks);
 *  - the "Dealer & borrower portal" template installed (its functions, workflows and journeys) and published.
 * Idempotent: existing connections are reused and an installed portal is left alone.
 *
 *   bun run demo:auto-finance
 *
 * Then: http://demo-auto.localhost:3001 — staff (password lintelia-dev-password): underwriter@demo-auto.test,
 * funding@demo-auto.test, admin@demo-auto.test; the dealer portal: dealer@sunrise-motors.test (e-mailed code or the
 * same password). Fakes: LoanPro http://localhost:9410, QuickBooks :9411, Sheets :9412, AI :9409, Mailbox :8025.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:8000';
const TENANT = 'demo-auto';
const PASSWORD = process.env.SEED_PASSWORD || 'lintelia-dev-password';
const ports = JSON.parse(readFileSync(join(import.meta.dir, '../../../dev/ports.json'), 'utf8')).services as Record<string, { port: number; url?: string }>;
const fake = (name: string) => ports[name]?.url ?? `http://localhost:${ports[name]?.port}`;

async function api<T = any>(token: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': TENANT, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function waitForApi() {
  for (let i = 0; i < 90; i++) {
    if (await fetch(`${API}/health`).then((r) => r.ok).catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`The API is not answering at ${API}`);
}

/** Open the connector's settings page from its hand-off URL and submit it, like a browser. */
async function submitConnectorPage(url: string, values: Record<string, string>) {
  const html = await (await fetch(url)).text();
  const session = html.match(/name="session" value="([^"]+)"/)?.[1];
  if (!session) throw new Error(`No settings form at ${url}`);
  const target = new URL(url);
  const result = await (await fetch(new URL(target.pathname, target.origin), { method: 'POST', body: new URLSearchParams({ session, ...values }) })).text();
  if (!result.includes('lintelia:connector-saved')) throw new Error(`The connector refused the settings: ${result.match(/<div class="error"[^>]*>([^<]*)</)?.[1] ?? result.slice(0, 200)}`);
}

const CONNECTIONS: Array<{ key: string; connector: string; name?: string; values: Record<string, string> }> = [
  { key: 'AI', connector: 'ai', values: { baseUrl: `${fake('llm')}/v1`, apiKey: 'sk-demo-auto-finance', model: 'fake-extractor-1' } },
  { key: 'LOANPRO', connector: 'loanpro', values: { baseUrl: `${fake('loanpro')}/api/public/api/1`, instanceId: 'demo-auto', apiToken: 'lp-demo-auto-finance', webhookSecret: 'loanpro-demo-webhook-secret' } },
  { key: 'DOCUMENSO', connector: 'documenso', values: { apiKey: 'documenso-demo-auto-finance', webhookSecret: 'documenso-demo-webhook-secret', baseUrl: `${fake('documenso')}/api/v2` } },
  { key: 'SHEETS', connector: 'http', name: 'Deal log (Google Sheets)', values: { label: 'Deal log (Google Sheets)', baseUrl: fake('sheets'), authType: 'bearer', token: 'ya29.demo-auto-finance' } },
  { key: 'QUICKBOOKS', connector: 'http', name: 'QuickBooks Online', values: { label: 'QuickBooks Online', baseUrl: fake('quickbooks'), authType: 'bearer', token: 'qbo-demo-auto-finance' } },
];

async function main() {
  await waitForApi();
  const login = await api<{ token?: string }>(null, 'POST', '/auth/login', { email: 'admin@demo-auto.test', password: PASSWORD });
  if (!login.token) throw new Error('admin@demo-auto.test could not sign in (run the seed first)');
  const token = login.token;

  const app = await api<{ draft: { journeys?: Record<string, unknown> }; activeVersion: number | null }>(token, 'GET', '/client-apps/current');
  if (app.activeVersion && app.draft?.journeys?.submit_deal) {
    console.log('Demo Auto Finance: the dealer & borrower portal is already installed');
    return;
  }

  const existing = await api<Array<{ id: string; connectorId: string; displayName: string | null; status: string }>>(token, 'GET', '/integrations');
  const chosen: Record<string, string> = {};
  for (const connection of CONNECTIONS) {
    const found = existing.find((c) => c.connectorId === connection.connector && c.status === 'active' && (!connection.name || c.displayName === connection.name));
    if (found) {
      chosen[connection.key] = found.id;
      continue;
    }
    const started = await api<{ installationId: string; url: string }>(token, 'POST', `/integrations/${connection.connector}/install`);
    await submitConnectorPage(started.url, connection.values);
    chosen[connection.key] = started.installationId;
    console.log(`Demo Auto Finance: connected ${connection.name ?? connection.connector}`);
  }

  await api(token, 'POST', '/client-apps/current/template', {
    template: 'dealer-finance', connections: chosen,
    parameters: { SPREADSHEET_ID: 'demo-auto-deal-log', QBO_REALM: '9130350000000001', DEALER_FEE: '395' },
  });
  const published = await api<{ activeVersion: number }>(token, 'POST', '/client-apps/current/publish');
  console.log(`Demo Auto Finance: dealer & borrower portal installed and published (v${published.activeVersion}) — http://demo-auto.localhost:3001`);
}

await main();
