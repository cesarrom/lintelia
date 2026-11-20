import postgres from 'postgres';
import { createConnector, type Installation } from '@repo/connector-sdk';
import { manifest } from './manifest';

/**
 * postgres-datasource (docs/plans/03 §First connectors): parameterised queries against the institution's database.
 * Values are always bound parameters (never spliced into the SQL), queries run in a READ ONLY transaction unless the
 * connection allows changes, with a statement timeout and a row limit.
 */
interface Settings {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
  writable: boolean;
}

const clients = new Map<string, { key: string; sql: postgres.Sql }>();

function client(installationId: string, settings: Settings, password: string | null) {
  const key = JSON.stringify([settings.host, settings.port, settings.database, settings.user, settings.ssl, password]);
  const cached = clients.get(installationId);
  if (cached?.key === key) return cached.sql;
  void cached?.sql.end({ timeout: 5 });
  const sql = postgres({
    host: settings.host, port: Number(settings.port), database: settings.database, username: settings.user, password: password ?? undefined,
    ssl: settings.ssl ? 'require' : false, max: 3, idle_timeout: 30, connect_timeout: 10, onnotice: () => { },
  });
  clients.set(installationId, { key, sql });
  return sql;
}

/** `:name` placeholders → `$n` (outside quotes), with the values in order. */
export function bindNamed(query: string, params: Record<string, unknown>) {
  const values: unknown[] = [];
  const positions = new Map<string, number>();
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < query.length; i++) {
    const ch = query[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; out += ch; continue; }
    if (ch === ':' && query[i + 1] === ':') { out += '::'; i++; continue; }
    const match = ch === ':' ? /^[A-Za-z_][A-Za-z0-9_]*/.exec(query.slice(i + 1)) : null;
    if (match) {
      const name = match[0];
      if (!(name in params)) throw new Error(`Missing value for parameter :${name}`);
      if (!positions.has(name)) { values.push(params[name]); positions.set(name, values.length); }
      out += `$${positions.get(name)}`;
      i += name.length;
      continue;
    }
    out += ch;
  }
  return { text: out, values };
}

const connector = createConnector({
  manifest,
  settings: {
    intro: 'Lintelia workflows will read from this database with these credentials. Use a login that can only read what workflows need.',
    fields: [
      { name: 'host', label: 'Host', required: true, placeholder: 'db.yourbank.internal' },
      { name: 'port', label: 'Port', type: 'number', required: true, default: 5432 },
      { name: 'database', label: 'Database', required: true },
      { name: 'user', label: 'User', required: true },
      { name: 'password', label: 'Password', secret: true, required: true },
      { name: 'ssl', label: 'Require TLS', type: 'checkbox' },
      { name: 'writable', label: 'Allow queries that change data', type: 'checkbox', help: 'off: every query runs in a read-only transaction' },
    ],
    async test(values, secrets) {
      const sql = postgres({
        host: values.host, port: Number(values.port), database: values.database, username: values.user, password: secrets.password ?? undefined,
        ssl: values.ssl ? 'require' : false, max: 1, connect_timeout: 10, onnotice: () => { },
      });
      try {
        await sql`select 1`;
      } catch (error) {
        throw new Error(`Could not connect to ${values.database} on ${values.host}:${values.port}: ${(error as Error).message}`);
      } finally {
        await sql.end({ timeout: 2 });
      }
    },
    summary: (values) => ({ database: `${values.database} on ${values.host}:${values.port}`, user: values.user, access: values.writable ? 'read-write' : 'read-only' }),
    displayName: (values) => `${values.database} (${values.host})`,
  },
  async onUninstall(installation: Installation) {
    await clients.get(installation.id)?.sql.end({ timeout: 5 });
    clients.delete(installation.id);
  },
});

connector.action('query.run', async ({ installation, config, log }) => {
  const settings = installation.config as unknown as Settings;
  const maxRows = Math.min(Math.max(Number(config.maxRows ?? 100), 1), 1000);
  let bound;
  try {
    bound = bindNamed(String(config.query ?? ''), (config.params ?? {}) as Record<string, unknown>);
  } catch (error) {
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
  const sql = client(installation.id, settings, await installation.secrets.get('password'));
  try {
    const rows = await sql.begin(async (tx) => {
      if (!settings.writable) await tx.unsafe('set transaction read only');
      await tx.unsafe("set local statement_timeout = '10s'");
      return tx.unsafe(bound.text, bound.values as never[]);
    });
    const list = [...rows].slice(0, maxRows).map((r) => ({ ...r }));
    return { outcome: 'success', output: { rows: list, rowCount: rows.length, truncated: rows.length > maxRows } };
  } catch (error) {
    log.error('query failed', { installation: installation.id, error: (error as Error).message });
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
});

await connector.listen();
