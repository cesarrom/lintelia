import { Inject, Injectable, Scope } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import jsonata from 'jsonata';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { clientAppDefinitionSchema, clientIdentitySchema, type ClientIdentity, type Tenant } from '@repo/fintivio/schemas';
import { clientProfiles, clientRecords, users } from '../entities';
import { TENANT } from '../injector/tokens/tenant.token';
import { AUTH_CONTEXT } from '../injector/tokens/auth-context.token';
import type { AuthContext } from '../auth/auth-context';
import { CASE_REPOSITORY } from '../engine/engine.client';
import type { CaseRepository } from '../engine/case-repository';
import { IdentityService } from '../auth/identity.service';
import { AuditWriter, type AuditActor } from '../services/audit.writer';
import { EventsService } from '../services/events.service';
import { redis } from '../clients/redis.client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { deleteRecord, ensureProfile, listRecords, loadMe, updateProfile, writeRecord } from './profiles';
import { loadActiveDefinition, loadApp } from './runtime-data';

const HANDOFF_TTL_SECONDS = 300;
const COLLECTION = /^[a-z][a-z0-9_-]{0,63}$/;
const RECORD_KEY = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export interface MappedIdentity {
  externalId: string | null;
  email: string | null;
  name: string | null;
  attributes: Record<string, unknown>;
  segments: string[] | null;
}

/**
 * How clients known to the institution's own systems become (and stay) clients here (docs/plans/11 §13 decision 3):
 *  - server-created sessions: the institution's backend (API client, `clients:provision`) upserts a client by its own
 *    `externalId` and gets a single-use, 5-minute `clientSecret` its front end hands to the SDK;
 *  - token exchange: a JWT from the institution's identity provider, verified against its JWKS;
 *  - self sign-up on the app (registration fields, consents).
 * One mapping (JSONata per profile field) turns any of these inputs into the profile. A new client emits
 * `client.registered`, which starts the workflows that listen to it.
 * Also the client records API: the data the institution's systems push for their clients' apps.
 */
@Injectable({ scope: Scope.REQUEST })
export class ClientProvisioningService {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly repository: CaseRepository,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(EventsService) private readonly events: EventsService,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(AUTH_CONTEXT) private readonly auth: AuthContext,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.repository.db(this.tenant.id);
  }

  private get actor(): AuditActor {
    const user = this.auth.user;
    return user ? { type: user.kind, id: user.userId, email: user.email } : { type: 'system' };
  }

  /** Identity settings of the published app (or of the draft before the first publication, or the defaults). */
  private async identitySettings(): Promise<ClientIdentity> {
    const active = await loadActiveDefinition(this.db);
    if (active) return active.definition.identity;
    const app = await loadApp(this.db);
    const parsed = app ? clientAppDefinitionSchema.safeParse(app.draft) : null;
    return parsed?.success ? parsed.data.identity : clientIdentitySchema.parse({});
  }

  /** Apply the mapping (JSONata per field) to an input: a request body or the claims of a token. */
  async map(input: Record<string, unknown>, identity: ClientIdentity): Promise<MappedIdentity> {
    const run = async (expression: string | undefined) => {
      if (!expression) return undefined;
      try {
        return await jsonata(expression).evaluate(input);
      } catch {
        throw new BadRequestError(`The identity mapping "${expression}" could not be evaluated`);
      }
    };
    const text = (value: unknown) => (value === undefined || value === null || value === '' ? null : String(value).trim());
    const attributes: Record<string, unknown> = {};
    // Attributes sent as such are kept; mapped ones are added on top.
    if (input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)) Object.assign(attributes, input.attributes);
    for (const [key, expression] of Object.entries(identity.mapping.attributes)) {
      const value = await run(expression);
      if (value !== undefined) attributes[key] = value;
    }
    const segments = identity.mapping.segments ? await run(identity.mapping.segments) : input.segments;
    return {
      externalId: text(await run(identity.mapping.externalId)),
      email: text(await run(identity.mapping.email)),
      name: text(await run(identity.mapping.name)),
      attributes,
      segments: Array.isArray(segments) ? segments.map(String) : null,
    };
  }

  /** Find the client for an external identity (then by e-mail if allowed), or create it; keep the profile up to date. */
  async upsert(mapped: MappedIdentity, source: string, identity: ClientIdentity, method: string) {
    if (!mapped.externalId) throw new BadRequestError('externalId is required (your identifier of the customer)');
    if (mapped.email && !EMAIL.test(mapped.email)) throw new BadRequestError('email is not a valid e-mail address');
    let created = false;
    const [linked] = await this.db.select({ userId: clientProfiles.userId }).from(clientProfiles)
      .where(and(eq(clientProfiles.externalSource, source), eq(clientProfiles.externalId, mapped.externalId))).limit(1);
    let [user] = linked ? await this.db.select().from(users).where(eq(users.id, linked.userId)).limit(1) : [];
    if (!user && mapped.email) {
      const [byEmail] = await this.db.select().from(users).where(sql`lower(${users.email}) = ${mapped.email.toLowerCase()}`).limit(1);
      if (byEmail) {
        if (byEmail.kind !== 'client') throw new ConflictError('This e-mail address belongs to a member of the institution');
        if (!identity.linkByEmail) throw new ConflictError('A client with this e-mail address exists; linking by e-mail is disabled');
        const profile = await ensureProfile(this.db, byEmail.id);
        if (profile.externalId && (profile.externalSource !== source || profile.externalId !== mapped.externalId)) {
          throw new ConflictError('This client is already linked to another identity');
        }
        user = byEmail;
      }
    }
    if (!user) {
      if (!mapped.email) throw new BadRequestError('email is required to register a new client');
      [user] = await this.db.insert(users).values({ email: mapped.email, name: mapped.name || mapped.email, kind: 'client', status: 'active' }).returning();
      created = true;
    } else if (mapped.name && (user.name === user.email || !user.name)) {
      [user] = await this.db.update(users).set({ name: mapped.name }).where(eq(users.id, user.id)).returning();
    }
    if (user.status !== 'active') throw new ForbiddenError('This client is disabled');
    await updateProfile(this.db, user.id, {
      externalSource: source, externalId: mapped.externalId, attributes: mapped.attributes,
      // Segments from the mapping are added, never removed: workflows and the team add their own (e.g. customer).
      ...(mapped.segments ? { addSegments: mapped.segments } : {}),
    });
    if (created) await this.registered(user.id, method);
    return { user, created };
  }

  /** A new client: audited, and the workflows listening to `client.registered` start (welcome, onboarding…). */
  async registered(userId: string, method: string, audit = true) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;
    if (audit) await this.audit.record(this.tenant.id, { type: 'client', id: user.id, email: user.email }, 'client.registered', { type: 'user', id: user.id }, { method });
    await this.events.emit('client.registered', { clientId: user.id, email: user.email, name: user.name, method },
      { type: 'client', id: user.id, email: user.email }, { id: user.id, email: user.email, name: user.name });
  }

  /**
   * What the app's sign-up asks for (public, before sign-in): profile fields and consents. `available` is false when
   * the institution has no published app (the plain sign-up form is used).
   */
  async registrationForm() {
    const active = await loadActiveDefinition(this.db);
    if (!active) return { available: false, enabled: true, fields: [], consents: [] };
    const { registration, profile, name, theme } = active.definition;
    const fields = registration.fields
      .map((key) => profile.fields.find((f) => f.key === key))
      .filter((f): f is NonNullable<typeof f> => !!f)
      .map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options ?? [], required: !!f.required }));
    return { available: true, app: name, enabled: registration.enabled, methods: registration.methods, fields, consents: registration.consents, theme };
  }

  /** Sites that may show the app in a frame (Content-Security-Policy frame-ancestors of `/embed/app`). */
  async embedPolicy() {
    const active = await loadActiveDefinition(this.db);
    return { frameAncestors: active?.definition.embed.allowedOrigins ?? [] };
  }

  /** Refuse a self sign-up the app does not allow (disabled, required consent missing). */
  async checkSignUp(consents: Array<{ key?: string; version?: string }> | undefined) {
    const active = await loadActiveDefinition(this.db);
    if (!active) return;
    const { registration } = active.definition;
    if (!registration.enabled) throw new ForbiddenError('Sign-up is by invitation only');
    const missing = registration.consents.filter((c) => c.required && !(consents ?? []).some((given) => given.key === c.key && given.version === c.version));
    if (missing.length) throw new BadRequestError(`Please accept: ${missing.map((c) => c.label).join(', ')}`);
  }

  /** After self sign-up on the app: the registration fields and consents it asked for, then `client.registered`. */
  async afterSignUp(userId: string, input: { profile?: Record<string, unknown>; consents?: Array<{ key?: string; version?: string }>; method: string }) {
    const active = await loadActiveDefinition(this.db);
    if (active) {
      const allowed = new Set(active.definition.registration.fields);
      const attributes = Object.fromEntries(Object.entries(input.profile ?? {}).filter(([key, value]) => allowed.has(key) && ['string', 'number'].includes(typeof value)).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 500) : v]));
      const at = new Date().toISOString();
      const consents = (input.consents ?? []).filter((c) => active.definition.registration.consents.some((k) => k.key === c.key && k.version === c.version))
        .map((c) => ({ key: c.key!, version: c.version!, acceptedAt: at }));
      const profile = await ensureProfile(this.db, userId);
      await this.db.update(clientProfiles).set({ attributes: { ...profile.attributes, ...attributes }, consents: [...profile.consents, ...consents] }).where(eq(clientProfiles.id, profile.id));
    }
    // Sign-up already wrote `client.registered` to the audit trail (identity service).
    await this.registered(userId, input.method, false);
  }

  /**
   * `POST /client-sessions` (the institution's backend): upsert the client and return a single-use secret its front end
   * gives the SDK, which exchanges it for a client session (`POST /auth/client-sessions/exchange`).
   */
  async createSession(body: Record<string, unknown>) {
    const identity = await this.identitySettings();
    const mapped = await this.map(body ?? {}, identity);
    const { user, created } = await this.upsert(mapped, 'api', identity, 'api');
    const clientSecret = `cs_${randomBytes(32).toString('base64url')}`;
    await redis().set(`client-handoff:${hash(clientSecret)}`, JSON.stringify({ tenantId: this.tenant.id, userId: user.id }), 'EX', HANDOFF_TTL_SECONDS);
    await this.audit.record(this.tenant.id, this.actor, 'client.session_created', { type: 'user', id: user.id, email: user.email }, { externalId: mapped.externalId, created });
    return { clientId: user.id, externalId: mapped.externalId, created, clientSecret, expiresAt: new Date(Date.now() + HANDOFF_TTL_SECONDS * 1000).toISOString() };
  }

  /** Exchange a `clientSecret` (once) for a client session. */
  async exchangeSecret(clientSecret: string) {
    if (!clientSecret) throw new BadRequestError('clientSecret is required');
    const stored = await redis().send('GETDEL', [`client-handoff:${hash(clientSecret)}`]) as string | null;
    const entry = stored ? JSON.parse(stored) as { tenantId: string; userId: string } : null;
    if (!entry || entry.tenantId !== this.tenant.id) throw new ForbiddenError('This client secret is invalid, used or expired');
    const session = await this.identity.sessionForClient(this.tenant, entry.userId);
    await this.audit.record(this.tenant.id, { type: 'client', id: entry.userId, email: session.user.email }, 'client.signed_in', { type: 'user', id: entry.userId }, { method: 'client_secret' });
    return session;
  }

  /** Exchange a token of the institution's identity provider (verified against its JWKS) for a client session. */
  async exchangeToken(subjectToken: string) {
    if (!subjectToken) throw new BadRequestError('subjectToken is required');
    const identity = await this.identitySettings();
    const settings = identity.tokenExchange;
    if (!settings.enabled || !settings.issuer || !settings.jwksUri) throw new ForbiddenError('Token exchange is not enabled for this institution');
    let jwks = jwksCache.get(settings.jwksUri);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(settings.jwksUri));
      jwksCache.set(settings.jwksUri, jwks);
    }
    let claims: JWTPayload;
    try {
      ({ payload: claims } = await jwtVerify(subjectToken, jwks, { issuer: settings.issuer, ...(settings.audience ? { audience: settings.audience } : {}) }));
    } catch (error) {
      throw new ForbiddenError(`The token was refused: ${(error as Error).message}`);
    }
    const mapped = await this.map({ ...claims, externalId: claims.sub }, {
      ...identity, mapping: { ...identity.mapping, externalId: identity.mapping.externalId === 'externalId' ? 'sub' : identity.mapping.externalId },
    });
    const { user } = await this.upsert(mapped, settings.issuer, identity, 'token_exchange');
    const session = await this.identity.sessionForClient(this.tenant, user.id);
    await this.audit.record(this.tenant.id, { type: 'client', id: user.id, email: user.email }, 'client.signed_in', { type: 'user', id: user.id }, { method: 'token_exchange', issuer: settings.issuer });
    return session;
  }

  // --- client data (the institution's systems) ---------------------------------------------------------------------

  /** A client by id, or `ext:<externalId>` (the institution's own identifier, as given to `POST /client-sessions`). */
  private async resolveClient(ref: string) {
    if (ref.startsWith('ext:')) {
      const [row] = await this.db.select({ userId: clientProfiles.userId }).from(clientProfiles).where(and(eq(clientProfiles.externalSource, 'api'), eq(clientProfiles.externalId, ref.slice(4)))).limit(1);
      if (!row) throw new NotFoundError('Client not found');
      return row.userId;
    }
    if (!/^[0-9a-f-]{36}$/i.test(ref)) throw new NotFoundError('Client not found');
    const [user] = await this.db.select({ id: users.id, kind: users.kind }).from(users).where(eq(users.id, ref)).limit(1);
    if (!user || user.kind !== 'client') throw new NotFoundError('Client not found');
    return user.id;
  }

  private collection(name: string) {
    if (!COLLECTION.test(name)) throw new BadRequestError('collection: lower-case letters, digits, - and _');
    return name;
  }

  async profile(ref: string) {
    return loadMe(this.db, await this.resolveClient(ref));
  }

  async patchProfile(ref: string, body: { attributes?: Record<string, unknown>; segments?: unknown; addSegments?: unknown; removeSegments?: unknown }) {
    const clientId = await this.resolveClient(ref);
    const list = (value: unknown) => (Array.isArray(value) ? value.map(String) : undefined);
    await updateProfile(this.db, clientId, {
      attributes: body?.attributes && typeof body.attributes === 'object' ? body.attributes : {},
      segments: list(body?.segments), addSegments: list(body?.addSegments), removeSegments: list(body?.removeSegments),
    });
    await this.audit.record(this.tenant.id, this.actor, 'client_profile.updated', { type: 'user', id: clientId }, { attributes: Object.keys(body?.attributes ?? {}) });
    return loadMe(this.db, clientId);
  }

  /** Every record of a client, by collection (the back office's client page). */
  async allRecords(ref: string) {
    const clientId = await this.resolveClient(ref);
    const rows = await this.db.select({ collection: clientRecords.collection }).from(clientRecords).where(eq(clientRecords.clientId, clientId)).groupBy(clientRecords.collection);
    const result: Record<string, unknown[]> = {};
    for (const { collection } of rows) result[collection] = await listRecords(this.db, clientId, collection, 200);
    return result;
  }

  async records(ref: string, collection: string) {
    return listRecords(this.db, await this.resolveClient(ref), this.collection(collection));
  }

  async putRecord(ref: string, collection: string, key: string, body: { data?: Record<string, unknown>; merge?: boolean }) {
    const clientId = await this.resolveClient(ref);
    if (!RECORD_KEY.test(key)) throw new BadRequestError('key: letters, digits and . _ : - (up to 128)');
    const data = body?.data ?? body;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BadRequestError('data must be an object');
    if (JSON.stringify(data).length > 32_000) throw new BadRequestError('A record is limited to 32 kB');
    const record = await writeRecord(this.db, { clientId, collection: this.collection(collection), key, data: data as Record<string, unknown>, source: this.auth.user?.kind === 'api_client' ? 'api' : `member:${this.auth.user?.email}`, mode: body?.merge ? 'merge' : 'upsert' });
    await this.audit.record(this.tenant.id, this.actor, 'client_record.written', { type: 'client_record', id: `${collection}/${key}` }, { clientId });
    return record;
  }

  /** Many records of one collection at once (`{ records: [{ key, data }], replace? }`); `replace` deletes the others. */
  async putRecords(ref: string, collection: string, body: { records?: Array<{ key?: string; data?: Record<string, unknown> }>; replace?: boolean }) {
    const clientId = await this.resolveClient(ref);
    const name = this.collection(collection);
    const items = Array.isArray(body?.records) ? body.records.slice(0, 1000) : [];
    for (const item of items) if (!item.key || !RECORD_KEY.test(item.key) || !item.data || typeof item.data !== 'object') throw new BadRequestError('every record needs a key and a data object');
    if (body?.replace) {
      const keep = new Set(items.map((i) => i.key!));
      for (const existing of await listRecords(this.db, clientId, name, 5000)) if (!keep.has(existing.key)) await deleteRecord(this.db, clientId, name, existing.key);
    }
    for (const item of items) await writeRecord(this.db, { clientId, collection: name, key: item.key!, data: item.data!, source: 'api' });
    await this.audit.record(this.tenant.id, this.actor, 'client_record.written', { type: 'client_record', id: name }, { clientId, count: items.length, replace: !!body?.replace });
    return { collection: name, written: items.length };
  }

  async deleteRecord(ref: string, collection: string, key: string) {
    const clientId = await this.resolveClient(ref);
    const deleted = await deleteRecord(this.db, clientId, this.collection(collection), key);
    if (!deleted) throw new NotFoundError('Record not found');
    await this.audit.record(this.tenant.id, this.actor, 'client_record.deleted', { type: 'client_record', id: `${collection}/${key}` }, { clientId });
    return { deleted: true };
  }
}
