import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { randomBytes } from 'node:crypto';
import { CASE_RECORD_TYPES, type ConnectorManifest } from '@repo/lintelia/schemas';
import { caseFiles, caseRecords, cases, clientProfiles, connectorInstallationIndex, connectorInstallations, uploads, users } from '../entities';
import { deleteRecord, listRecords, writeRecord } from '../client-apps/profiles';
import { EventRouter } from '../services/event-router';
import { FileStore } from '../files/file-store';
import { quarantineKey } from '../files/object-store';
import { policyFor } from '../files/policy';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { redis } from '../clients/redis.client';
import { OneTimeSecrets } from '../auth/session.store';
import { CORE_ISSUER, signAsCore, signingKey } from '../auth/signing-keys';
import { env } from '../constants';
import { AuditWriter } from '../services/audit.writer';
import { TenantDirectory } from '../services/tenant-directory.service';
import { ENGINE_CLIENT, EngineClient } from '../engine/engine.client';
import { BadRequestError, ConflictError, ForbiddenError, HttpError, NotFoundError } from '../http/errors';
import { ConnectorRegistry, connectorUrl } from './registry';
import { CALLBACK_AUDIENCE, type CallbackClaims } from './connector-invoker';

export const CONNECTOR_API_AUDIENCE = 'connector-api';
export const TOKEN_ENDPOINT_AUDIENCE = 'lintelia-core';
const ACCESS_TTL_SECONDS = 900;
const CODE_TTL_SECONDS = 120;

export class UnauthorizedError extends HttpError { constructor(message = 'Unauthorized') { super(message, 401); } }

/** What the core knows about the person who sent the browser to the connector (connect/setup flows). */
export interface ExchangeCodeData {
  installationId: string;
  tenantId: string;
  connectorId: string;
  purpose: 'connect' | 'setup';
  returnUrl: string;
  user: { id: string; email: string; name?: string | null };
  tenant: { name: string; domain: string; pallette: unknown };
}

export interface ConnectorPrincipal {
  installationId: string;
  tenantId: string;
  connectorId: string;
  scopes: string[];
}

/**
 * The connector API (docs/plans/03): how connectors authenticate (private_key_jwt, exchange codes, installation
 * tokens — the GitHub Apps model), report their installation, complete async steps and write canonical records and
 * events. Connectors never get a tenant context beyond their installation.
 */
@Injectable()
export class ConnectorApiService {
  private readonly codes = new OneTimeSecrets(redis());
  private readonly jwks = new Map<string, { url: string; get: JWTVerifyGetKey }>();

  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(ConnectorRegistry) private readonly registry: ConnectorRegistry,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(TenantDirectory) private readonly directory: TenantDirectory,
    @Inject(ENGINE_CLIENT) private readonly engine: EngineClient,
    @Inject(FileStore) private readonly files: FileStore,
    @Inject(EventRouter) private readonly router: EventRouter,
  ) { }

  // --- codes (browser hand-off) ------------------------------------------------------------------------------------

  async issueCode(data: ExchangeCodeData) {
    const code = randomBytes(24).toString('base64url');
    await this.codes.put('connector-code', code, data as unknown as Record<string, unknown>, CODE_TTL_SECONDS);
    return code;
  }

  // --- client authentication (private_key_jwt, RFC 7523) ----------------------------------------------------------

  private async verifyClientAssertion(assertion: string | undefined): Promise<ConnectorManifest> {
    if (!assertion) throw new UnauthorizedError('client_assertion is required');
    let connectorId: string;
    try {
      connectorId = String(decodeJwt(assertion).iss ?? '');
    } catch {
      throw new UnauthorizedError('Malformed client assertion');
    }
    const manifest = this.registry.manifest(connectorId);
    if (!manifest) throw new UnauthorizedError('Unknown or unapproved connector');
    const url = connectorUrl(manifest, manifest.auth.jwksUrl);
    let entry = this.jwks.get(connectorId);
    if (!entry || entry.url !== url) {
      entry = { url, get: createRemoteJWKSet(new URL(url), { cacheMaxAge: 300_000, cooldownDuration: 5_000 }) };
      this.jwks.set(connectorId, entry);
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(assertion, entry.get, { issuer: connectorId, subject: connectorId, audience: TOKEN_ENDPOINT_AUDIENCE, maxTokenAge: '5m' }));
    } catch (error) {
      throw new UnauthorizedError(`Invalid client assertion: ${(error as Error).message}`);
    }
    if (!payload.jti) throw new UnauthorizedError('client assertion needs a jti');
    const fresh = await redis().send('SET', [`connector-jti:${connectorId}:${payload.jti}`, '1', 'EX', '600', 'NX']);
    if (!fresh) throw new UnauthorizedError('client assertion replayed');
    return manifest;
  }

  private async accessToken(installationId: string, tenantId: string, connectorId: string, scopes: string[]) {
    return signAsCore({ tid: tenantId, con: connectorId, scope: scopes.join(' ') }, { audience: CONNECTOR_API_AUDIENCE, subject: installationId, expiresIn: `${ACCESS_TTL_SECONDS}s` });
  }

  private async installationRow(installationId: string) {
    const [index] = await this.databases.platform.select().from(connectorInstallationIndex).where(eq(connectorInstallationIndex.installationId, installationId)).limit(1);
    if (!index) return null;
    const [row] = await this.databases.forTenant(index.tenantId).select().from(connectorInstallations).where(eq(connectorInstallations.id, installationId)).limit(1);
    return row ? { index, row } : null;
  }

  /** `POST /connector-api/oauth/token` */
  async token(body: Record<string, string | undefined>) {
    const manifest = await this.verifyClientAssertion(body.client_assertion);
    if (body.grant_type === 'authorization_code') {
      const data = await this.codes.take<ExchangeCodeData>('connector-code', body.code ?? '');
      if (!data || data.connectorId !== manifest.id) throw new BadRequestError('invalid_grant');
      const found = await this.installationRow(data.installationId);
      if (!found) throw new BadRequestError('invalid_grant');
      return {
        access_token: await this.accessToken(data.installationId, data.tenantId, manifest.id, found.row.grantedScopes),
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SECONDS,
        installation: this.presentInstallation(found.row),
        context: { purpose: data.purpose, returnUrl: data.returnUrl, user: data.user, tenant: data.tenant },
      };
    }
    if (body.grant_type === 'client_credentials') {
      const found = await this.installationRow(body.installation_id ?? '');
      if (!found || found.index.connectorId !== manifest.id) throw new BadRequestError('invalid_grant');
      if (found.row.status === 'disabled') throw new ForbiddenError('This installation is disabled');
      return {
        access_token: await this.accessToken(found.row.id, found.index.tenantId, manifest.id, found.row.grantedScopes),
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SECONDS,
      };
    }
    throw new BadRequestError('unsupported_grant_type');
  }

  /** Authenticate a connector API call (installation access token). */
  async authenticate(authorization: string | null, scope?: string): Promise<ConnectorPrincipal> {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedError();
    const { publicJwk } = await signingKey();
    const { importJWK } = await import('jose');
    let payload;
    try {
      ({ payload } = await jwtVerify(token, await importJWK(publicJwk, 'EdDSA'), { issuer: CORE_ISSUER, audience: CONNECTOR_API_AUDIENCE }));
    } catch {
      throw new UnauthorizedError('Invalid or expired installation token');
    }
    const principal: ConnectorPrincipal = {
      installationId: String(payload.sub), tenantId: String(payload.tid), connectorId: String(payload.con),
      scopes: String(payload.scope ?? '').split(' ').filter(Boolean),
    };
    if (!this.registry.manifest(principal.connectorId)) throw new ForbiddenError('Connector revoked');
    if (scope && !principal.scopes.includes(scope)) throw new ForbiddenError(`Missing scope ${scope}`);
    return principal;
  }

  private presentInstallation(row: typeof connectorInstallations.$inferSelect) {
    return { id: row.id, displayName: row.displayName, status: row.status, audience: row.audience, scopes: row.grantedScopes, configSummary: row.configSummary, connectorVersion: row.connectorVersion };
  }

  private actor(principal: ConnectorPrincipal) {
    return { type: 'connector', id: principal.installationId, email: `${principal.connectorId}@connectors` };
  }

  // --- installation ----------------------------------------------------------------------------------------------

  async getInstallation(principal: ConnectorPrincipal) {
    const found = await this.installationRow(principal.installationId);
    if (!found) throw new NotFoundError('Installation not found');
    return this.presentInstallation(found.row);
  }

  async updateInstallation(principal: ConnectorPrincipal, body: { status?: string; displayName?: string; configSummary?: Record<string, unknown>; lastError?: string | null; secretsChanged?: string[] }) {
    const found = await this.installationRow(principal.installationId);
    if (!found) throw new NotFoundError('Installation not found');
    if (found.row.status === 'disabled') throw new ConflictError('This installation was removed');
    const changes: Partial<typeof connectorInstallations.$inferInsert> = {};
    if (body.status === 'active' || body.status === 'failing') changes.status = body.status;
    if (typeof body.displayName === 'string' && body.displayName.trim()) changes.displayName = body.displayName.trim().slice(0, 255);
    if (body.configSummary && typeof body.configSummary === 'object') changes.configSummary = body.configSummary;
    if (body.lastError !== undefined) changes.lastError = body.lastError;
    const [row] = await this.databases.forTenant(principal.tenantId).update(connectorInstallations).set(changes)
      .where(eq(connectorInstallations.id, principal.installationId)).returning();
    if (changes.status && changes.status !== found.row.status) {
      await this.audit.record(principal.tenantId, this.actor(principal), changes.status === 'active' ? 'integration.connected' : 'integration.failing',
        { type: 'integration', id: row.id, name: row.displayName }, { connector: principal.connectorId, lastError: row.lastError });
    }
    // Connectors report secret changes (names only, never values) so the institution's audit log shows them.
    const secrets = Array.isArray(body.secretsChanged) ? body.secretsChanged.filter((n) => typeof n === 'string').slice(0, 20) : [];
    if (secrets.length) {
      await this.audit.record(principal.tenantId, this.actor(principal), 'integration.secrets_changed', { type: 'integration', id: row.id, name: row.displayName }, { connector: principal.connectorId, secrets });
    }
    return this.presentInstallation(row);
  }

  // --- executions ------------------------------------------------------------------------------------------------

  async complete(principal: ConnectorPrincipal, body: { callbackToken?: string; outcome?: string; output?: Record<string, unknown> }) {
    const claims = await this.callbackClaims(principal, body.callbackToken);
    const manifest = this.registry.manifest(principal.connectorId)!;
    const outcomes = new Set(manifest.components.flatMap((c) => c.events));
    if (!body.outcome || !outcomes.has(body.outcome)) throw new BadRequestError(`Unknown outcome "${body.outcome}"; expected one of ${[...outcomes].join(', ')}`);
    const once = await redis().send('SET', [`connector-complete:${claims.pr}:${claims.cid}`, '1', 'EX', String(30 * 24 * 3600), 'NX']);
    if (!once) throw new ConflictError('This step was already completed');
    await this.engine.resolve(claims.tid, claims.cid, claims.pr, { outcome: body.outcome, output: body.output ?? {}, by: { type: 'connector', id: principal.installationId } });
    await this.audit.record(claims.tid, this.actor(principal), 'connector.step_completed', { type: 'case', id: claims.cid }, { step: claims.sid, outcome: body.outcome }, claims.cid);
    return { completed: true };
  }

  private async callbackClaims(principal: ConnectorPrincipal, token: string | undefined): Promise<CallbackClaims> {
    if (!token) throw new BadRequestError('callbackToken is required');
    const { publicJwk } = await signingKey();
    const { importJWK } = await import('jose');
    try {
      const { payload } = await jwtVerify(token, await importJWK(publicJwk, 'EdDSA'), { issuer: CORE_ISSUER, audience: CALLBACK_AUDIENCE });
      const claims = payload as unknown as CallbackClaims;
      if (claims.sub !== principal.installationId || claims.tid !== principal.tenantId) throw new Error('not this installation');
      return claims;
    } catch (error) {
      throw new ForbiddenError(`Invalid callback token: ${(error as Error).message}`);
    }
  }

  // --- canonical records -------------------------------------------------------------------------------------------

  async upsertRecord(principal: ConnectorPrincipal, body: { type?: string; externalRef?: string; callbackToken?: string; caseId?: string; status?: string; summary?: string; data?: Record<string, unknown> }) {
    if (!CASE_RECORD_TYPES.includes(body.type as never)) throw new BadRequestError(`type must be one of ${CASE_RECORD_TYPES.join(', ')}`);
    if (!body.externalRef || !body.status) throw new BadRequestError('externalRef and status are required');
    let caseId: string | null = null;
    if (body.callbackToken) caseId = (await this.callbackClaims(principal, body.callbackToken)).cid;
    else if (body.caseId) {
      const [kase] = await this.databases.forTenant(principal.tenantId).select({ id: cases.id }).from(cases).where(eq(cases.id, body.caseId));
      if (!kase) throw new NotFoundError('Case not found');
      caseId = kase.id;
    }
    const db = this.databases.forTenant(principal.tenantId);
    const now = new Date().toISOString();
    const [existing] = await db.select().from(caseRecords).where(and(eq(caseRecords.installationId, principal.installationId), eq(caseRecords.type, body.type!), eq(caseRecords.externalRef, body.externalRef)));
    const values = { status: body.status, summary: body.summary ?? null, data: body.data ?? {}, ...(caseId ? { caseId } : {}) };
    const [row] = existing
      ? await db.update(caseRecords).set({ ...values, history: existing.status !== body.status ? [...existing.history, { at: now, status: body.status }] : existing.history })
        .where(eq(caseRecords.id, existing.id)).returning()
      : await db.insert(caseRecords).values({
        ...values, caseId, type: body.type!, externalRef: body.externalRef, installationId: principal.installationId, connectorId: principal.connectorId,
        history: [{ at: now, status: body.status }],
      }).returning();
    if (!existing || existing.status !== body.status) {
      await this.audit.record(principal.tenantId, this.actor(principal), `record.${body.type}.${existing ? 'updated' : 'created'}`, { type: body.type!, id: row.id }, { status: body.status }, row.caseId);
    }
    return row;
  }

  // --- documents -------------------------------------------------------------------------------------------------

  /**
   * A document from the connector (signed agreement, verification evidence) for a case: it goes through the same intake
   * as any upload (type check, malware scan; byte-identical for signed PDFs) before it appears on the case.
   */
  async uploadFile(principal: ConnectorPrincipal, body: { callbackToken?: string; caseId?: string; name?: string; contentType?: string; contentBase64?: string; kind?: string }) {
    let caseId: string | null = null;
    if (body.callbackToken) caseId = (await this.callbackClaims(principal, body.callbackToken)).cid;
    else if (body.caseId) {
      const [kase] = await this.databases.forTenant(principal.tenantId).select({ id: cases.id }).from(cases).where(eq(cases.id, body.caseId));
      if (!kase) throw new NotFoundError('Case not found');
      caseId = kase.id;
    }
    if (!caseId) throw new BadRequestError('callbackToken or caseId is required');
    const name = String(body.name ?? '').replace(/[\\/\0]/g, '_').trim().slice(0, 255);
    if (!name || !body.contentBase64 || !body.contentType) throw new BadRequestError('name, contentType and contentBase64 are required');
    const bytes = Buffer.from(body.contentBase64, 'base64');
    const policy = policyFor('connector_document');
    if (!policy.types.includes(body.contentType)) throw new BadRequestError(`Unsupported type ${body.contentType}`);
    if (bytes.length > policy.maxBytes) throw new BadRequestError('Document too large');
    const kind = body.kind && /^[a-z0-9_]{1,64}$/.test(body.kind) ? body.kind : null;
    const [upload] = await this.databases.forTenant(principal.tenantId).insert(uploads).values({
      purpose: 'connector_document', ownerType: 'connector', ownerId: principal.installationId, caseId, declaredName: name,
      declaredSize: bytes.length, declaredType: body.contentType, kind, status: 'uploaded', expiresAt: new Date(Date.now() + 3600_000),
    }).returning();
    await this.files.objects.put(quarantineKey(principal.tenantId, upload.id), bytes);
    await this.audit.record(principal.tenantId, this.actor(principal), 'file.uploaded', { type: 'upload', id: upload.id, name }, { size: bytes.length, purpose: 'connector_document', kind }, caseId);
    await this.files.startIntake(principal.tenantId, upload.id);
    return { uploadId: upload.id, status: 'uploaded' };
  }

  /**
   * Read a document of the case a step runs for (e.g. to extract data from a pay stub): only files of that case or of
   * its parent cases (a function called by the deal), through the step's callback token. Audited.
   */
  async readFile(principal: ConnectorPrincipal, fileId: string, callbackToken: string | undefined) {
    const claims = await this.callbackClaims(principal, callbackToken);
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw new NotFoundError('File not found');
    const db = this.databases.forTenant(principal.tenantId);
    const [file] = await db.select().from(caseFiles).where(eq(caseFiles.id, fileId)).limit(1);
    let allowed = false;
    let caseId: string | null = claims.cid;
    for (let depth = 0; file && caseId && depth < 4 && !allowed; depth++) {
      if (file.caseId === caseId) allowed = true;
      else caseId = (await db.select({ parent: cases.parentCaseId }).from(cases).where(eq(cases.id, caseId)).limit(1))[0]?.parent ?? null;
    }
    if (!file || !allowed) throw new NotFoundError('File not found for this case');
    const content = await this.files.objects.get(file.storageKey);
    if (!content) throw new NotFoundError('File content is not available');
    await this.audit.record(principal.tenantId, this.actor(principal), 'file.read_by_connector', { type: 'file', id: file.id, name: file.name }, { step: claims.sid }, file.caseId);
    return { id: file.id, name: file.name, contentType: file.contentType, size: file.size, contentBase64: content.toString('base64') };
  }

  // --- client records --------------------------------------------------------------------------------------------

  /**
   * What a client sees in the client app, kept current by a system of record (e.g. the loan servicing system after a
   * payment): records of one collection for one client, found by id, by its identifier in that system or by e-mail.
   */
  async writeClientRecords(principal: ConnectorPrincipal, body: { client?: { id?: string; externalId?: string; source?: string; email?: string }; collection?: string; records?: Array<{ key?: string; data?: Record<string, unknown> }>; mode?: string; replace?: boolean }) {
    const db = this.databases.forTenant(principal.tenantId);
    const ref = body.client ?? {};
    let clientId: string | null = null;
    if (ref.id && /^[0-9a-f-]{36}$/i.test(ref.id)) clientId = (await db.select({ id: users.id }).from(users).where(and(eq(users.id, ref.id), eq(users.kind, 'client'))).limit(1))[0]?.id ?? null;
    else if (ref.externalId) clientId = (await db.select({ id: clientProfiles.userId }).from(clientProfiles).where(and(eq(clientProfiles.externalSource, ref.source || principal.connectorId), eq(clientProfiles.externalId, ref.externalId))).limit(1))[0]?.id ?? null;
    else if (ref.email) clientId = (await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${ref.email.toLowerCase()}`, eq(users.kind, 'client'))).limit(1))[0]?.id ?? null;
    if (!clientId) throw new NotFoundError('Client not found');
    const collection = String(body.collection ?? '');
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(collection)) throw new BadRequestError('collection: lower-case letters, digits, - and _');
    const items = Array.isArray(body.records) ? body.records.slice(0, 500) : [];
    for (const item of items) if (!item.key || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(item.key) || !item.data || typeof item.data !== 'object') throw new BadRequestError('every record needs a key and a data object');
    const written = [];
    for (const item of items) {
      written.push(await writeRecord(db, { clientId, collection, key: item.key!, data: item.data!, source: `connector:${principal.connectorId}`, mode: body.mode === 'merge' ? 'merge' : 'upsert' }));
    }
    if (body.replace) {
      const keep = new Set(items.map((i) => i.key));
      for (const row of await listRecords(db, clientId, collection, 5000)) if (!keep.has(row.key)) await deleteRecord(db, clientId, collection, row.key);
    }
    await this.audit.record(principal.tenantId, this.actor(principal), 'client_record.written', { type: 'client_record', id: collection }, { clientId, count: written.length }, null);
    return { clientId, collection, written: written.length };
  }

  // --- events ----------------------------------------------------------------------------------------------------

  /**
   * Connector events (`connector:<id>/<type>`), routed like every event (docs/plans/17 §3.4): to the open cases
   * waiting for them (by business keys, e.g. the loan a payment is about), then starting the workflows whose
   * `startOn` lists them (or handing them to their open case).
   */
  async publishEvent(principal: ConnectorPrincipal, body: { id?: string; type?: string; subject?: string; data?: Record<string, unknown>; applicantEmail?: string }) {
    if (!body.id || !body.type) throw new BadRequestError('id and type are required');
    const event = `connector:${principal.connectorId}/${body.type}`;
    const db = this.databases.forTenant(principal.tenantId);
    let applicant: { id: string; email: string; name: string } | null = null;
    if (body.applicantEmail) {
      const [client] = await db.select().from(users).where(and(sql`lower(${users.email}) = ${body.applicantEmail.toLowerCase()}`, eq(users.kind, 'client')));
      if (client) applicant = { id: client.id, email: client.email, name: client.name };
    }
    const routed = await this.router.route(principal.tenantId, {
      type: event, data: { ...(body.data ?? {}), subject: body.subject ?? null }, source: `connector:${principal.connectorId}`,
      dedupeKey: `connector:${principal.installationId}:${body.id}`, applicant,
      actor: { type: 'connector', id: principal.installationId, email: `${principal.connectorId}@connectors` },
    });
    return { duplicate: routed.duplicate, delivered: routed.delivered, started: routed.started };
  }

  /** The core's own URL, for the docs endpoint. */
  base() {
    return env.HOST;
  }

  /** Tenant lookup for lifecycle notifications. */
  tenantById(id: string) {
    return this.directory.findById(id);
  }
}
