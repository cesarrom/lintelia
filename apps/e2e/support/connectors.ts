import { expect } from '@playwright/test';
import { Api, expectStatus } from './api';
import { env } from './env';

/**
 * Connectors (docs/plans/03) from a test's point of view: start a connection in the core, then fill in the
 * connector's own page like a browser would (form post with the page session), exactly as an administrator does.
 */
export async function requireConnector(id: string) {
  const url = env.connectors[id];
  try {
    const res = await fetch(new URL('/health', url), { signal: AbortSignal.timeout(2000) });
    if (res.ok) return url;
  } catch {
    // fall through
  }
  throw new Error(`Connector "${id}" is not running at ${url} (start the stack with the full profile: bun run stack)`);
}

const sessionOf = (html: string) => html.match(/name="session" value="([^"]+)"/)?.[1];
const alertOf = (html: string) => html.match(/<div class="error"[^>]*>([^<]*)</)?.[1] ?? null;

export interface ConnectorPageResult {
  status: number;
  html: string;
  error: string | null;
  saved: boolean;
}

/** Open a connector page from its hand-off URL (single-use code) and submit the settings form. */
export async function submitConnectorPage(handOffUrl: string, values: Record<string, string | number | boolean>): Promise<ConnectorPageResult> {
  const page = await fetch(handOffUrl);
  const html = await page.text();
  expect(page.status, alertOf(html) ?? html.slice(0, 300)).toBe(200);
  const session = sessionOf(html);
  expect(session, 'the connector page has a session').toBeTruthy();
  const form = new URLSearchParams({ session: session! });
  for (const [key, value] of Object.entries(values)) {
    if (value === false) continue;
    form.set(key, String(value));
  }
  const url = new URL(handOffUrl);
  const submitted = await fetch(new URL(url.pathname, url.origin), { method: 'POST', body: form });
  const result = await submitted.text();
  return { status: submitted.status, html: result, error: alertOf(result), saved: result.includes('fintivio:connector-saved') };
}

/** Install a connector for the tenant of `api` and complete its connect page. Returns the installation id. */
export async function connect(api: Api, connectorId: string, values: Record<string, string | number | boolean>) {
  await requireConnector(connectorId);
  const started = await api.post(`/integrations/${connectorId}/install`);
  expectStatus(started, 201);
  const result = await submitConnectorPage(started.body.url, values);
  return { installationId: started.body.installationId as string, result };
}

/** Open the settings page of an existing connection and submit it. */
export async function updateSettings(api: Api, installationId: string, values: Record<string, string | number | boolean>) {
  const session = await api.post(`/integrations/${installationId}/setup-session`);
  expectStatus(session, 200);
  return submitConnectorPage(session.body.url, values);
}

/** Settings of the local mailbox as an SMTP server (fake-services/mailbox accepts any password but "wrong"). */
export const mailboxSmtp = (overrides: Record<string, string | number | boolean> = {}) => ({
  host: 'localhost', port: 1025, username: 'bank-mailer', password: 'smtp-secret-e2e', fromAddress: 'no-reply@bank.example', fromName: 'E2E Bank', ...overrides,
});

/** Settings of the institution's "core banking" database (created by the global setup). */
export const coreBankingDatabase = (overrides: Record<string, string | number | boolean> = {}) => ({
  host: env.externalDatabase.host, port: env.externalDatabase.port, database: env.externalDatabase.database,
  user: env.externalDatabase.user, password: env.externalDatabase.password, ...overrides,
});
