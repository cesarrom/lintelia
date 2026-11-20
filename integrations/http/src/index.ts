import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createConnector, type Installation } from '@repo/connector-sdk';

/**
 * HTTP API connector (docs/plans/12): one connection per API of the institution's world (QuickBooks, Google Sheets, a
 * valuation service, its own core system…) holding the base address and the credentials — API key, bearer token,
 * basic, or OAuth 2.0 client credentials (tokens fetched and cached here) — so workflows call the API without ever
 * seeing a secret. The other way round, `/hooks/<connection>/<key>` receives that system's webhooks (shared secret or
 * HMAC signature) and publishes `connector:http/webhook.<key>`, which starts the workflows listening to it.
 *
 * Together with functions (workflows used as steps) this is how an institution builds its own connector without code.
 */
type AuthType = 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';

interface Settings {
  label: string;
  baseUrl: string;
  authType: AuthType;
  apiKeyHeader?: string;
  username?: string;
  tokenUrl?: string;
  clientId?: string;
  scope?: string;
  headers?: string;
  testPath?: string;
}

const PRODUCTION = process.env.NODE_ENV === 'production';
const TIMEOUT_MS = 20_000;
const MAX_RESPONSE = 1_000_000;

/** Outside development, only public https addresses (no credentials sent to internal services). */
function assertAllowed(url: URL) {
  if (!PRODUCTION) return;
  if (url.protocol !== 'https:') throw new Error('Only https addresses are allowed');
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|0\.)/.test(url.hostname)) throw new Error('Private addresses are not allowed');
}

const staticHeaders = (value: string | undefined) => Object.fromEntries((value ?? '').split(/[;\n]/).map((pair) => pair.split(':')).filter((p) => p.length >= 2 && p[0].trim()).map(([k, ...v]) => [k.trim(), v.join(':').trim()]));

const tokens = new Map<string, { token: string; expiresAt: number }>();

async function authHeaders(installation: Installation, settings: Settings): Promise<Record<string, string>> {
  switch (settings.authType) {
    case 'api_key': return { [settings.apiKeyHeader || 'X-API-Key']: (await installation.secrets.get('apiKey')) ?? '' };
    case 'bearer': return { Authorization: `Bearer ${(await installation.secrets.get('token')) ?? ''}` };
    case 'basic': return { Authorization: `Basic ${Buffer.from(`${settings.username ?? ''}:${(await installation.secrets.get('password')) ?? ''}`).toString('base64')}` };
    case 'oauth2': {
      const cached = tokens.get(installation.id);
      if (cached && cached.expiresAt > Date.now()) return { Authorization: `Bearer ${cached.token}` };
      const url = new URL(settings.tokenUrl ?? '');
      assertAllowed(url);
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS),
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: settings.clientId ?? '', client_secret: (await installation.secrets.get('clientSecret')) ?? '', ...(settings.scope ? { scope: settings.scope } : {}) }),
      });
      if (!response.ok) throw new Error(`The token endpoint answered ${response.status}`);
      const body = await response.json() as { access_token: string; expires_in?: number };
      tokens.set(installation.id, { token: body.access_token, expiresAt: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 });
      return { Authorization: `Bearer ${body.access_token}` };
    }
    default: return {};
  }
}

/** The address of a call: always under the connection's base address (a path, never another host). */
function target(settings: Settings, path: unknown, query: unknown) {
  const raw = String(path ?? '').trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) throw new Error('The path must be relative to the connection\'s base address');
  const base = settings.baseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/${raw.replace(/^\/+/, '')}`);
  if (!url.href.startsWith(base)) throw new Error('The path leaves the connection\'s base address');
  for (const [key, value] of Object.entries(asObject(query))) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  assertAllowed(url);
  return url;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function send(installation: Installation, method: string, path: unknown, options: { query?: unknown; headers?: unknown; body?: unknown } = {}) {
  const settings = installation.config as unknown as Settings;
  const url = target(settings, path, options.query);
  const headers: Record<string, string> = { Accept: 'application/json', ...staticHeaders(settings.headers), ...Object.fromEntries(Object.entries(asObject(options.headers)).map(([k, v]) => [k, String(v)])), ...(await authHeaders(installation, settings)) };
  let body: string | undefined;
  if (options.body !== undefined && options.body !== null && options.body !== '' && !['GET', 'HEAD'].includes(method)) {
    if (typeof options.body === 'string') {
      body = options.body;
      headers['Content-Type'] ??= /^\s*[[{]/.test(body) ? 'application/json' : 'text/plain';
    } else {
      body = JSON.stringify(options.body);
      headers['Content-Type'] ??= 'application/json';
    }
  }
  const started = Date.now();
  const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' });
  const text = (await response.text()).slice(0, MAX_RESPONSE);
  let parsed: unknown = text;
  if ((response.headers.get('content-type') ?? '').includes('json') || /^\s*[[{]/.test(text)) {
    try { parsed = JSON.parse(text); } catch { /* text */ }
  }
  return {
    status: response.status, ok: response.ok, body: parsed, durationMs: Date.now() - started,
    headers: Object.fromEntries(['content-type', 'location', 'etag', 'x-request-id'].map((h) => [h, response.headers.get(h)]).filter(([, v]) => v)),
    url: `${url.origin}${url.pathname}`,
  };
}

const connector = createConnector({
  manifest: {
    id: 'http', version: '1.0.0', name: 'HTTP API', description: 'Call any HTTP API with stored credentials, and receive its webhooks to start workflows.',
    publisher: { name: 'Lintelia' }, categories: ['developer'], icon: 'Globe', audiences: ['tenant'], scopes: ['installation:write', 'events:publish'],
    components: [{
      key: 'request', version: 1, kind: 'action', title: 'Call an API (HTTP)', description: 'An HTTP request to the connection\'s API; the response becomes the step\'s result. Non-2xx answers follow the "failed" event.',
      icon: 'Globe', category: 'data',
      configSchema: {
        type: 'object', required: ['method'],
        properties: {
          method: { type: 'string', title: 'Method', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        },
      },
      inputSchema: {
        type: 'object', required: ['path'],
        properties: {
          path: { type: 'string', title: 'Path', description: 'relative to the connection, e.g. /v3/company/123/bill or {{input.id}}' },
          query: { type: 'string', title: 'Query parameters', description: "an object, e.g. = { 'status': 'open' }" },
          headers: { type: 'string', title: 'Extra headers', description: "an object, e.g. = { 'Idempotency-Key': case.reference }" },
          body: { type: 'string', title: 'Body', description: "JSON, e.g. = { 'amount': input.amount }" },
        },
      },
      defaults: { method: 'GET', input: { path: '/' } },
      summary: '{{method}} via {{connection}}', events: ['succeeded', 'failed'], invoke: { url: '', mode: 'sync' }, dataClasses: [],
    }],
    triggers: [], egress: ['the API configured in each connection'],
    dataHandling: { stores: ['credentials of each API (encrypted)', 'cached OAuth access tokens (memory)'], retention: 'deleted when the connection is removed', regions: [] },
  },
  settings: {
    intro: 'One connection per API. Credentials stay in this connector; workflows only choose the connection and the path.',
    fields: [
      { name: 'label', label: 'Name of this API', required: true, placeholder: 'e.g. QuickBooks', help: 'shown in the workflow editor' },
      { name: 'baseUrl', label: 'Base address', type: 'url', required: true, placeholder: 'https://api.example.com/v1' },
      {
        name: 'authType', label: 'Authentication', type: 'select', required: true, default: 'none',
        options: [{ value: 'none', label: 'None' }, { value: 'api_key', label: 'API key in a header' }, { value: 'bearer', label: 'Bearer token' }, { value: 'basic', label: 'Basic (user name and password)' }, { value: 'oauth2', label: 'OAuth 2.0 client credentials' }],
      },
      { name: 'apiKeyHeader', label: 'API key header', default: 'X-API-Key', help: 'for "API key in a header"' },
      { name: 'apiKey', label: 'API key', secret: true },
      { name: 'token', label: 'Bearer token', secret: true },
      { name: 'username', label: 'User name', help: 'for basic authentication' },
      { name: 'password', label: 'Password', secret: true },
      { name: 'tokenUrl', label: 'Token endpoint', type: 'url', help: 'for OAuth 2.0' },
      { name: 'clientId', label: 'Client id' },
      { name: 'clientSecret', label: 'Client secret', secret: true },
      { name: 'scope', label: 'Scope' },
      { name: 'headers', label: 'Headers sent with every call', help: 'e.g. Accept-Version: 2; X-Team: lending' },
      { name: 'testPath', label: 'Path to test the connection', help: 'a GET that should answer 2xx, e.g. /health (empty: no test)' },
      { name: 'webhookSecret', label: 'Webhook secret', secret: true, help: 'to receive this system\'s webhooks (shared secret header or HMAC-SHA256 signature)' },
    ],
    async test(values, secrets, context) {
      const settings = values as Settings;
      assertAllowed(new URL(settings.baseUrl));
      const needed: Record<AuthType, string[]> = { none: [], api_key: ['apiKey'], bearer: ['token'], basic: ['password'], oauth2: ['clientSecret'] };
      for (const name of needed[settings.authType] ?? []) if (!secrets[name]) throw new Error(`Enter the ${name === 'apiKey' ? 'API key' : name === 'token' ? 'bearer token' : name === 'password' ? 'password' : 'client secret'}`);
      if (settings.authType === 'oauth2' && (!settings.tokenUrl || !settings.clientId)) throw new Error('OAuth 2.0 needs the token endpoint and the client id');
      if (!settings.testPath) return;
      const fake: Installation = {
        id: context.installationId, status: 'pending', config: values, context: {}, store: null as never, core: null as never,
        secrets: { get: async (name: string) => secrets[name] ?? null } as never,
      };
      tokens.delete(context.installationId);
      const result = await send(fake, 'GET', settings.testPath).catch((e) => { throw new Error(`Could not reach ${settings.baseUrl}: ${e.message}`); });
      if (!result.ok) throw new Error(`${settings.testPath} answered ${result.status}: check the address and the credentials`);
    },
    notes: (context) => [`Webhooks from this system: POST ${context.publicUrl}/hooks/${context.installationId}/<key> (header X-Webhook-Secret, or X-Signature: sha256=<HMAC of the body>) starts the workflows listening to connector:http/webhook.<key>`],
    summary: (values) => ({ api: new URL(values.baseUrl).host, auth: values.authType }),
    displayName: (values) => String(values.label || new URL(values.baseUrl).host),
  },
});

connector.action('request', async ({ installation, config, input, log }) => {
  const method = String(config.method ?? 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw new Error(`Unsupported method ${method}`);
  try {
    const result = await send(installation, method, input.path, { query: input.query, headers: input.headers, body: input.body });
    log.info('http request', { installation: installation.id, method, url: result.url, status: result.status, ms: result.durationMs });
    return { outcome: result.ok ? 'succeeded' : 'failed', output: result };
  } catch (error) {
    log.error('http request failed', { installation: installation.id, method, error: (error as Error).message });
    return { outcome: 'failed', output: { status: 0, ok: false, error: (error as Error).message } };
  }
});

/** Inbound webhooks of the connected system → `connector:http/webhook.<key>`. */
connector.app.post('/hooks/:installationId/:key', async (c) => {
  const installation = await connector.installation(c.req.param('installationId'));
  if (!installation || installation.status === 'pending') return c.json({ error: 'unknown connection' }, 404);
  const key = c.req.param('key');
  if (!/^[a-z][a-z0-9_.-]{0,63}$/.test(key)) return c.json({ error: 'invalid key' }, 400);
  const secret = await installation.secrets.get('webhookSecret');
  if (!secret) return c.json({ error: 'this connection has no webhook secret' }, 403);
  const raw = await c.req.text();
  const shared = c.req.header('x-webhook-secret');
  const signature = (c.req.header('x-signature') ?? c.req.header('x-hub-signature-256') ?? '').replace(/^sha256=/, '');
  const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const valid = (shared && equal(shared, secret)) || (signature && equal(signature, createHmac('sha256', secret).update(raw).digest('hex')));
  if (!valid) return c.json({ error: 'invalid signature' }, 401);
  let body: unknown = raw;
  try { body = JSON.parse(raw); } catch { /* text */ }
  const id = c.req.header('webhook-id') ?? c.req.header('x-event-id') ?? createHash('sha256').update(`${key}:${raw}`).digest('hex').slice(0, 32);
  const result = await installation.core.events.publish({
    id, type: `webhook.${key}`, subject: key,
    data: { key, body, connection: (installation.config as unknown as Settings).label, receivedAt: new Date().toISOString() },
    applicantEmail: typeof (body as { email?: unknown })?.email === 'string' ? (body as { email: string }).email : undefined,
  });
  connector.log.info('webhook received', { installation: installation.id, key, duplicate: result.duplicate, started: result.started.length });
  return c.json({ received: true, duplicate: result.duplicate, started: result.started.map((s) => s.reference) }, 202);
});

await connector.listen();
