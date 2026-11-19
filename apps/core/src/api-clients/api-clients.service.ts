import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { grantablePermissionIds } from '../access/catalog';
import { apiClientIndex, apiClients } from '../entities';
import type { Databases } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { AuditWriter } from '../services/audit.writer';
import { BadRequestError, ForbiddenError, NotFoundError } from '../http/errors';
import { newClientId, newSecret, ROTATION_GRACE_MS } from './api-clients';

const present = (row: typeof apiClients.$inferSelect) => ({
  id: row.id,
  clientId: row.clientId,
  name: row.name,
  permissions: row.permissions,
  status: row.status,
  secrets: row.secrets.map((s) => ({ id: s.id, prefix: s.prefix, createdAt: s.createdAt, expiresAt: s.expiresAt })),
  expiresAt: row.expiresAt,
  createdBy: row.createdByEmail,
  lastUsedAt: row.lastUsedAt,
  createdAt: row.createdAt,
});

/**
 * API clients of the institution (docs/plans/04): its own systems calling the API with OAuth client credentials.
 * Secrets are shown once and stored as SHA-256 hashes; permissions can never exceed the creator's.
 */
@Injectable({ scope: Scope.REQUEST })
export class ApiClientsService {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) { }

  private get db() {
    return this.databases.forTenant(this.tenant.id);
  }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  async list() {
    const rows = await this.db.select().from(apiClients).orderBy(desc(apiClients.createdAt));
    return rows.map(present);
  }

  private async validPermissions(permissions: unknown): Promise<string[]> {
    if (!Array.isArray(permissions) || !permissions.length) throw new BadRequestError('Choose at least one permission');
    // Built-in and the institution's active custom permissions (docs/plans/15 §5.1).
    const known = new Set(await grantablePermissionIds(this.db));
    const unknown = permissions.filter((p) => !known.has(p));
    if (unknown.length) throw new BadRequestError(`Unknown permissions: ${unknown.join(', ')}`);
    // Same rule as roles: nobody grants what they do not hold.
    const missing = permissions.filter((p) => !this.user.permissions.includes(p));
    if (missing.length) throw new ForbiddenError(`You cannot grant permissions you do not have: ${missing.join(', ')}`);
    return [...new Set(permissions as string[])];
  }

  async create(input: { name?: string; permissions?: string[]; expiresAt?: string | null }) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestError('A name is required');
    const permissions = await this.validPermissions(input.permissions);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) throw new BadRequestError('The expiry date must be in the future');
    const clientId = newClientId();
    const { secret, record } = newSecret();
    const [row] = await this.db.insert(apiClients).values({ name, clientId, permissions, secrets: [record], expiresAt, createdByEmail: this.user.email }).returning();
    await this.databases.platform.insert(apiClientIndex).values({ clientId, tenantId: this.tenant.id });
    await this.audit.record(this.tenant.id, this.actor, 'api_client.created', { type: 'api_client', id: row.id, name }, { clientId, permissions });
    return { ...present(row), clientSecret: secret };
  }

  private async load(clientId: string) {
    const [row] = await this.db.select().from(apiClients).where(eq(apiClients.clientId, clientId)).limit(1);
    if (!row) throw new NotFoundError('API client not found');
    return row;
  }

  /** A new secret; the previous one keeps working for 24 hours so systems can switch without downtime. */
  async rotate(clientId: string) {
    const row = await this.load(clientId);
    if (row.status !== 'active') throw new BadRequestError('This API client is revoked');
    const { secret, record } = newSecret();
    const graceEnd = new Date(Date.now() + ROTATION_GRACE_MS).toISOString();
    const kept = row.secrets.filter((s) => !s.expiresAt || new Date(s.expiresAt) > new Date()).map((s) => ({ ...s, expiresAt: s.expiresAt ?? graceEnd }));
    const [updated] = await this.db.update(apiClients).set({ secrets: [...kept.slice(-1), record] }).where(eq(apiClients.id, row.id)).returning();
    await this.audit.record(this.tenant.id, this.actor, 'api_client.secret_rotated', { type: 'api_client', id: row.id, name: row.name }, { clientId, previousSecretValidUntil: graceEnd });
    return { ...present(updated), clientSecret: secret };
  }

  /** Immediate: tokens already issued stop working on their next request. */
  async revoke(clientId: string) {
    const row = await this.load(clientId);
    await this.db.update(apiClients).set({ status: 'revoked', revokedAt: new Date(), secrets: [] }).where(and(eq(apiClients.id, row.id)));
    await this.databases.platform.delete(apiClientIndex).where(eq(apiClientIndex.clientId, clientId));
    await this.audit.record(this.tenant.id, this.actor, 'api_client.revoked', { type: 'api_client', id: row.id, name: row.name }, { clientId });
  }
}
