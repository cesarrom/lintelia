import { Hono, type Context } from 'hono';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Sql } from 'postgres';
import { connectorManifestSchema, type ConnectorManifest } from '@repo/lintelia/schemas';
import { connectorEnv, type ConnectorEnv } from './env';
import { openDatabase, KeyValueStore, type InstallationRow } from './db';
import { SecretStore, redact } from './secrets';
import { CoreKeys, loadConnectorKeys, sha256Base64Url, type ConnectorKeys } from './keys';
import { CoreClient, type HandOffContext } from './core-client';
import { donePage, escapeHtml, layout, renderField, type SettingField } from './pages';

/** What a connector declares; `baseUrl` and `auth` are filled in at run time. */
export type ManifestInput = Omit<ConnectorManifest, 'baseUrl' | 'auth' | 'ui'> & { ui?: Partial<ConnectorManifest['ui']> };

/** The browser step a client must complete (rendered by the portal), for `client_step` components. */
export interface ClientAction {
  type: 'redirect' | 'embed' | 'sdk';
  url: string;
  /** For `sdk`: which web SDK the portal loads (e.g. `didit-web`). */
  sdk?: string;
  title?: string;
  instructions?: string;
}

export type ActionResult =
  | { outcome: string; output?: Record<string, unknown> }
  | { pending: true; ref?: string; clientAction?: ClientAction };

export interface Installation {
  id: string;
  status: InstallationRow['status'];
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  secrets: SecretStore;
  store: KeyValueStore;
  core: CoreClient;
}

export interface ActionContext {
  installation: Installation;
  /** Static configuration of the step (minus the connection). */
  config: Record<string, any>;
  /** Inputs mapped from the case. */
  input: Record<string, any>;
  case: { id: string; reference?: string };
  /** Token to complete async steps and attach records to the case. */
  callback: { token: string };
  idempotencyKey: string;
  log: Logger;
}

export type ActionHandler = (ctx: ActionContext) => Promise<ActionResult>;

export interface SettingsDefinition {
  title?: string;
  intro?: string;
  fields: SettingField[];
  /** Check the values against the vendor (throw an Error with a user-facing message when they do not work). */
  test?: (values: Record<string, any>, secrets: Record<string, string | null>, context: SettingsContext) => Promise<void>;
  /** Extra lines under the form (e.g. the webhook URL to paste in the vendor's console). Plain text. */
  notes?: (context: SettingsContext) => string[];
  /** Non-secret summary shown in the core (e.g. host, sender address). */
  summary?: (values: Record<string, any>) => Record<string, unknown>;
  displayName?: (values: Record<string, any>) => string;
}

export interface SettingsContext {
  installationId: string;
  /** Public base URL of this connector (webhook URLs). */
  publicUrl: string;
}

export interface ConnectorOptions {
  manifest: ManifestInput;
  settings?: SettingsDefinition;
  migrations?: Array<{ name: string; sql: string }>;
  /** Called before an installation's secrets and data are deleted (`uninstalled`). */
  onUninstall?: (installation: Installation) => Promise<void>;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

const logger = (connectorId: string): Logger => {
  const write = (level: string, message: string, data?: Record<string, unknown>) => {
    const line = redact(JSON.stringify({ at: new Date().toISOString(), level, connector: connectorId, message, ...data }));
    (level === 'error' ? console.error : console.log)(line);
  };
  return { info: (m, d) => write('info', m, d), error: (m, d) => write('error', m, d) };
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * A Lintelia connector service (docs/plans/03 §SDK): serves its manifest and JWKS, verifies the core's signed
 * requests, runs actions idempotently, handles lifecycle events, and renders the connect/settings pages from a field
 * list — secrets go to the SecretStore, everything else to the installation's config.
 */
export class Connector {
  readonly app = new Hono();
  readonly env: ConnectorEnv;
  readonly log: Logger;
  private sql!: Sql;
  private keys!: ConnectorKeys;
  private coreKeys!: CoreKeys;
  private readonly actions = new Map<string, ActionHandler>();
  private readonly optionHandlers = new Map<string, (installation: Installation) => Promise<Array<{ value: string; label: string }>>>();
  private readonly pageKey: Buffer;
  private ready: Promise<void> | null = null;

  constructor(private readonly options: ConnectorOptions) {
    this.env = connectorEnv(options.manifest.id);
    this.log = logger(options.manifest.id);
    this.pageKey = createHmac('sha256', this.env.kek).update('connector-pages').digest();
    this.routes();
  }

  get id() {
    return this.options.manifest.id;
  }

  get db() {
    return this.sql;
  }

  /** The manifest as served (absolute base URL of this deployment). */
  manifest(): ConnectorManifest {
    const input = this.options.manifest;
    return connectorManifestSchema.parse({
      ...input,
      baseUrl: this.env.publicUrl,
      auth: { jwksUrl: '/.well-known/jwks.json' },
      lifecycle: input.lifecycle ?? { url: '/lifecycle', events: ['uninstalled'] },
      options: input.options ?? (this.optionHandlers.size ? { url: '/options' } : undefined),
      ui: {
        connect: { url: '/connect', mode: 'redirect' },
        setup: { url: '/settings', mode: 'embedded' },
        ...input.ui,
      },
      components: input.components.map((c) => ({ ...c, invoke: { ...c.invoke, url: c.invoke.url || `/actions/${c.key}` } })),
    });
  }

  action(key: string, handler: ActionHandler) {
    this.actions.set(key, handler);
    return this;
  }

  /** Dynamic options of component fields (`x-options: <name>` in a config schema). */
  optionsFor(name: string, handler: (installation: Installation) => Promise<Array<{ value: string; label: string }>>) {
    this.optionHandlers.set(name, handler);
    return this;
  }

  // --- installations -------------------------------------------------------------------------------------------------

  async installation(id: string): Promise<Installation | null> {
    const [row] = await this.sql<InstallationRow[]>`select * from sdk_installations where id = ${id}`;
    return row ? this.wrap(row) : null;
  }

  private wrap(row: InstallationRow): Installation {
    return {
      id: row.id, status: row.status, config: row.config, context: row.context,
      secrets: new SecretStore(this.sql, this.env.kek, row.id),
      store: new KeyValueStore(this.sql, row.id),
      core: new CoreClient(this.env.coreUrl, this.id, this.keys, row.id),
    };
  }

  private async upsertInstallation(id: string, changes: Partial<Pick<InstallationRow, 'status' | 'config' | 'context'>>) {
    const [row] = await this.sql<InstallationRow[]>`
      insert into sdk_installations (id, status, config, context)
      values (${id}, ${changes.status ?? 'pending'}, ${this.sql.json((changes.config ?? {}) as never)}, ${this.sql.json((changes.context ?? {}) as never)})
      on conflict (id) do update set
        status = coalesce(${changes.status ?? null}, sdk_installations.status),
        config = case when ${changes.config ? true : false} then excluded.config else sdk_installations.config end,
        context = case when ${changes.context ? true : false} then excluded.context else sdk_installations.context end,
        updated_at = now()
      returning *`;
    return row;
  }

  // --- core request verification ----------------------------------------------------------------------------------

  /** Verify a core → connector request: EdDSA JWT from the core, audience = this connector, body hash, no replay. */
  private async verifyCore(c: Context, body: string): Promise<{ installationId: string }> {
    const token = c.req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new HttpError(401, 'Missing core token');
    let payload;
    try {
      payload = await this.coreKeys.verify(token, this.id);
    } catch (error) {
      throw new HttpError(401, `Invalid core token: ${(error as Error).message}`);
    }
    if (payload.body_hash !== sha256Base64Url(body)) throw new HttpError(401, 'Body hash mismatch');
    if (!payload.jti) throw new HttpError(401, 'Token without jti');
    const inserted = await this.sql`insert into sdk_seen_tokens (jti, expires_at) values (${payload.jti}, ${new Date((payload.exp ?? 0) * 1000)})
      on conflict do nothing returning jti`;
    if (!inserted.length) throw new HttpError(401, 'Token replayed');
    return { installationId: String(payload.sub ?? '') };
  }

  private async coreRequest(c: Context) {
    const text = await c.req.text();
    const { installationId } = await this.verifyCore(c, text);
    const body = JSON.parse(text || '{}');
    if (body.installationId && body.installationId !== installationId) throw new HttpError(401, 'Token is for another installation');
    return { installationId, body };
  }

  private fail(c: Context, error: unknown) {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status as 400);
    this.log.error('request failed', { path: c.req.path, error: (error as Error).message });
    return c.json({ error: 'Internal error' }, 500);
  }

  // --- page sessions (connect/settings) ----------------------------------------------------------------------------

  private signSession(data: Record<string, unknown>) {
    const payload = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 30 * 60_000 })).toString('base64url');
    const mac = createHmac('sha256', this.pageKey).update(payload).digest('base64url');
    return `${payload}.${mac}`;
  }

  private readSession(token: string | undefined): PageSession {
    const [payload, mac] = String(token ?? '').split('.');
    if (!payload || !mac) throw new HttpError(400, 'This page expired: open it again from Lintelia');
    const expected = createHmac('sha256', this.pageKey).update(payload).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new HttpError(400, 'Invalid page session');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PageSession & { exp: number };
    if (data.exp < Date.now()) throw new HttpError(400, 'This page expired: open it again from Lintelia');
    return data;
  }

  private frameHeaders(c: Context, returnUrl?: string) {
    const origins = [returnUrl ? new URL(returnUrl).origin : null, ...(process.env.CORE_WEB_ORIGINS ?? '').split(',').map((s) => s.trim())].filter(Boolean);
    c.header('Content-Security-Policy', `frame-ancestors ${origins.length ? origins.join(' ') : "'none'"}`);
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cache-Control', 'no-store');
  }

  private async renderSettings(c: Context, session: PageSession, values: Record<string, unknown>, error?: string) {
    const settings = this.options.settings ?? { fields: [] };
    const installation = (await this.installation(session.installationId))!;
    const secrets = new Map((await installation.secrets.list()).map((s) => [s.name, s.setAt]));
    const manifest = this.options.manifest;
    const title = settings.title ?? (session.purpose === 'connect' ? `Connect ${manifest.name}` : `${manifest.name} settings`);
    const body = `<h1>${escapeHtml(title)}</h1>
<p class="lead">${escapeHtml(settings.intro ?? manifest.description)}</p>
${error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : ''}
<form method="post" action="${session.purpose === 'connect' ? '/connect' : '/settings'}">
  <input type="hidden" name="session" value="${escapeHtml(this.signSession(session as never))}">
  ${settings.fields.map((f) => renderField(f, values[f.name], f.secret ? secrets.get(f.name) : undefined)).join('\n')}
  ${(settings.notes?.({ installationId: installation.id, publicUrl: this.env.publicUrl }) ?? []).map((n) => `<p class="muted" data-testid="connector-note">${escapeHtml(n)}</p>`).join('')}
  <div class="actions">
    <a class="secondary" href="${escapeHtml(session.returnUrl)}" target="_top">Cancel</a>
    <button type="submit">${session.purpose === 'connect' ? 'Test and connect' : 'Test and save'}</button>
  </div>
  <p class="muted">Secrets are stored encrypted by this connector and are never shown again or shared with Lintelia.</p>
</form>`;
    this.frameHeaders(c, session.returnUrl);
    return c.html(layout({ title, connectorName: manifest.name, tenantName: session.tenantName, accent: session.accent, body }), error ? 422 : 200);
  }

  private async openPage(c: Context) {
    const code = c.req.query('code');
    if (!code) throw new HttpError(400, 'Open this page from Lintelia (Integrations)');
    let redeemed;
    try {
      redeemed = await CoreClient.redeemCode(this.env.coreUrl, this.id, this.keys, code);
    } catch (error) {
      this.log.error('code redemption failed', { error: (error as Error).message });
      throw new HttpError(400, 'This link expired or was already used: open it again from Lintelia');
    }
    const context: HandOffContext = redeemed.context;
    const row = await this.upsertInstallation(redeemed.installation.id, {
      context: { tenantName: context.tenant.name, tenantDomain: context.tenant.domain },
    });
    const session: PageSession = {
      installationId: row.id, purpose: context.purpose, returnUrl: context.returnUrl, userEmail: context.user.email,
      tenantName: context.tenant.name, accent: context.tenant.pallette?.primary,
    };
    return this.renderSettings(c, session, row.config);
  }

  private async savePage(c: Context) {
    const form = await c.req.parseBody();
    const session = this.readSession(form.session as string);
    const settings = this.options.settings ?? { fields: [] };
    const installation = (await this.installation(session.installationId))!;
    const values: Record<string, unknown> = {};
    const secretValues: Record<string, string | null> = {};
    const changedSecrets: string[] = [];
    for (const field of settings.fields) {
      const raw = form[field.name];
      if (field.secret) {
        const given = typeof raw === 'string' ? raw : '';
        if (given) { secretValues[field.name] = given; changedSecrets.push(field.name); }
        else secretValues[field.name] = await installation.secrets.get(field.name);
        if (field.required && !secretValues[field.name]) return this.renderSettings(c, session, { ...installation.config, ...values }, `${field.label} is required`);
        continue;
      }
      if (field.type === 'checkbox') values[field.name] = raw === 'true';
      else if (field.type === 'number') values[field.name] = raw === '' || raw === undefined ? null : Number(raw);
      else values[field.name] = typeof raw === 'string' ? raw.trim() : '';
      if (field.required && (values[field.name] === '' || values[field.name] === null)) {
        return this.renderSettings(c, session, values, `${field.label} is required`);
      }
    }
    try {
      await settings.test?.(values, secretValues, { installationId: installation.id, publicUrl: this.env.publicUrl });
    } catch (error) {
      return this.renderSettings(c, session, values, (error as Error).message);
    }
    await this.upsertInstallation(installation.id, { config: values, status: 'active' });
    for (const name of changedSecrets) await installation.secrets.set(name, secretValues[name]!);
    await installation.core.installation.update({
      status: 'active',
      displayName: settings.displayName?.(values),
      configSummary: settings.summary?.(values) ?? {},
      lastError: null,
      secretsChanged: changedSecrets,
    });
    this.log.info('installation saved', { installation: installation.id, purpose: session.purpose, secretsChanged: changedSecrets });
    this.frameHeaders(c, session.returnUrl);
    return c.html(donePage({ title: 'Saved', connectorName: this.options.manifest.name, tenantName: session.tenantName, accent: session.accent }, session.returnUrl,
      session.purpose === 'connect' ? `${this.options.manifest.name} is connected.` : 'Settings saved.'));
  }

  // --- routes ------------------------------------------------------------------------------------------------------

  private routes() {
    const app = this.app;
    app.use('*', async (_c, next) => {
      await this.start();
      await next();
    });
    app.get('/health', (c) => c.json({ ok: true, connector: this.id }));
    app.get('/.well-known/lintelia-connector.json', (c) => c.json(this.manifest()));
    app.get('/.well-known/jwks.json', (c) => c.json({ keys: [this.keys.publicJwk] }));

    const page = (handler: (c: Context) => Promise<Response>) => async (c: Context) => {
      try {
        return await handler(c);
      } catch (error) {
        const message = error instanceof HttpError ? error.message : 'Something went wrong';
        if (!(error instanceof HttpError)) this.log.error('page failed', { error: (error as Error).message });
        return c.html(layout({ title: 'Error', connectorName: this.options.manifest.name, body: `<div class="error">${escapeHtml(message)}</div>` }), error instanceof HttpError ? (error.status as 400) : 500);
      }
    };
    app.get('/connect', page((c) => this.openPage(c)));
    app.get('/settings', page((c) => this.openPage(c)));
    app.post('/connect', page((c) => this.savePage(c)));
    app.post('/settings', page((c) => this.savePage(c)));

    app.post('/actions/:key', async (c) => {
      try {
        const { installationId, body } = await this.coreRequest(c);
        const key = c.req.param('key');
        const handler = this.actions.get(key);
        if (!handler) throw new HttpError(404, `Unknown action ${key}`);
        const installation = await this.installation(installationId);
        if (!installation || installation.status === 'pending') throw new HttpError(409, 'This connection is not set up');
        const idempotencyKey = String(body.idempotencyKey ?? c.req.header('idempotency-key') ?? randomUUID());
        const [previous] = await this.sql`select response from sdk_idempotency where installation_id = ${installationId} and key = ${idempotencyKey}`;
        if (previous) return c.json(previous.response);
        const result = await handler({
          installation, config: body.config ?? {}, input: body.input ?? {}, case: body.case ?? {}, callback: body.callback ?? { token: '' },
          idempotencyKey, log: this.log,
        });
        const response = 'pending' in result ? { ref: result.ref ?? null, clientAction: result.clientAction ?? null } : { outcome: result.outcome, output: result.output ?? {} };
        await this.sql`insert into sdk_idempotency (installation_id, key, response) values (${installationId}, ${idempotencyKey}, ${this.sql.json(response as never)})
          on conflict do nothing`;
        return c.json(response);
      } catch (error) {
        return this.fail(c, error);
      }
    });

    app.post('/options', async (c) => {
      try {
        const { installationId, body } = await this.coreRequest(c);
        const handler = this.optionHandlers.get(String(body.name));
        if (!handler) throw new HttpError(404, `No options named ${body.name}`);
        const installation = await this.installation(installationId);
        if (!installation) throw new HttpError(409, 'This connection is not set up');
        return c.json({ options: await handler(installation) });
      } catch (error) {
        return this.fail(c, error);
      }
    });

    app.post('/lifecycle', async (c) => {
      try {
        const { installationId, body } = await this.coreRequest(c);
        const installation = await this.installation(installationId);
        if (body.event === 'uninstalled' && installation) {
          await this.options.onUninstall?.(installation);
          await installation.secrets.shred();
          await this.sql`delete from sdk_installations where id = ${installationId}`;
          this.log.info('installation removed: secrets and data deleted', { installation: installationId });
        }
        return c.json({ received: true });
      } catch (error) {
        return this.fail(c, error);
      }
    });
  }

  /** Open the database and keys (idempotent; also runs lazily on the first request). */
  start() {
    return (this.ready ??= (async () => {
      this.keys = await loadConnectorKeys(this.env.dataDir, this.env.production);
      this.coreKeys = new CoreKeys(this.env.coreUrl);
      this.sql = await openDatabase(this.env.databaseUrl, this.options.migrations);
      setInterval(() => void this.sql`delete from sdk_seen_tokens where expires_at < now()`.catch(() => undefined), 10 * 60_000).unref();
    })());
  }

  async listen() {
    await this.start();
    const server = Bun.serve({ port: this.env.port, fetch: this.app.fetch, idleTimeout: 60 });
    this.log.info(`connector listening on ${this.env.publicUrl} (port ${server.port})`);
    return server;
  }
}

interface PageSession {
  installationId: string;
  purpose: 'connect' | 'setup';
  returnUrl: string;
  userEmail: string;
  tenantName?: string;
  accent?: string;
}

export const createConnector = (options: ConnectorOptions) => new Connector(options);
