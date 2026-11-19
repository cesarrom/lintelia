import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { CUSTOM_PERMISSION_RE, TENANT_PERMISSION_IDS, customPermissionKey, type Tenant, type User } from '@repo/fintivio/schemas';
import { apiClients, customPermissions, roles } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { TENANT } from '../injector/tokens/tenant.token';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import { USER } from '../injector/tokens/user.token';
import { AuditWriter } from '../services/audit.writer';
import { BadRequestError, ConflictError, NotFoundError } from '../http/errors';
import { presentCustomPermission } from './catalog';
import { AccessNotifier } from './notify';

/**
 * Custom permissions (docs/plans/15 §5.1): the institution names its own capabilities. Creating one grants nothing
 * (only `admin` holds it until someone puts it in a role, which is an access change). Archiving one is a revocation:
 * it is removed from every role and API client at once and the administrators are told.
 */
@Injectable({ scope: Scope.REQUEST })
export class CustomPermissionsService {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: TenantDatabase,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(AccessNotifier) private readonly notifier: AccessNotifier,
  ) { }

  private get actor() {
    return { type: this.user.kind, id: this.user.userId, email: this.user.email };
  }

  private async row(key: string) {
    const [row] = await this.db.select().from(customPermissions).where(eq(customPermissions.key, key)).limit(1);
    if (!row) throw new NotFoundError('Custom permission not found');
    return row;
  }

  private clean(input: { name?: unknown; description?: unknown; category?: unknown }) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim().slice(0, 1024) : '';
    const category = typeof input.category === 'string' && input.category.trim() ? input.category.trim().slice(0, 80) : 'Custom';
    return { name, description, category };
  }

  async create(input: { key?: string; name?: string; description?: string; category?: string }) {
    const { name, description, category } = this.clean(input);
    if (!name) throw new BadRequestError('A custom permission needs a name');
    if (name.length > 255) throw new BadRequestError('The name is too long');
    const key = customPermissionKey(input.key?.trim() || name);
    if (!CUSTOM_PERMISSION_RE.test(key)) throw new BadRequestError('The key must be custom: followed by lower-case letters, digits, . _ or -');
    if (TENANT_PERMISSION_IDS.includes(key)) throw new BadRequestError('This key is reserved');
    const [existing] = await this.db.select().from(customPermissions).where(eq(customPermissions.key, key)).limit(1);
    if (existing) throw new ConflictError(existing.archivedAt ? `${key} exists but is archived: restore it instead` : `${key} already exists`);
    const [row] = await this.db.insert(customPermissions).values({ key, name, description, category, createdByEmail: this.user.email }).returning();
    await this.audit.record(this.tenant.id, this.actor, 'permission.created', { type: 'permission', id: key, name }, { category });
    return presentCustomPermission(row);
  }

  async update(key: string, input: { name?: string; description?: string; category?: string }) {
    const current = await this.row(key);
    const changes: Partial<typeof customPermissions.$inferInsert> = {};
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (!name) throw new BadRequestError('A custom permission needs a name');
      changes.name = name.slice(0, 255);
    }
    if (input.description !== undefined) changes.description = String(input.description).trim().slice(0, 1024);
    if (input.category !== undefined) changes.category = String(input.category).trim().slice(0, 80) || 'Custom';
    if (!Object.keys(changes).length) return presentCustomPermission(current);
    const [row] = await this.db.update(customPermissions).set(changes).where(eq(customPermissions.id, current.id)).returning();
    await this.audit.record(this.tenant.id, this.actor, 'permission.updated', { type: 'permission', id: key }, { fields: Object.keys(changes) });
    return presentCustomPermission(row);
  }

  /** Revoke everywhere: roles (custom and extended system roles) and API clients stop holding it at once. */
  async archive(key: string) {
    const current = await this.row(key);
    if (current.archivedAt) return presentCustomPermission(current);
    const holders = await this.db.select({ key: roles.key, name: roles.name }).from(roles).where(sql`${key} = any(${roles.permissions})`);
    const clients = await this.db.select({ id: apiClients.id, name: apiClients.name }).from(apiClients).where(sql`${key} = any(${apiClients.permissions})`);
    const [row] = await this.db.transaction(async (tx) => {
      await tx.update(roles).set({ permissions: sql`array_remove(${roles.permissions}, ${key})` }).where(sql`${key} = any(${roles.permissions})`);
      await tx.update(apiClients).set({ permissions: sql`array_remove(${apiClients.permissions}, ${key})` }).where(sql`${key} = any(${apiClients.permissions})`);
      return tx.update(customPermissions).set({ archivedAt: new Date() }).where(eq(customPermissions.id, current.id)).returning();
    });
    await this.audit.record(this.tenant.id, this.actor, 'permission.archived', { type: 'permission', id: key, name: current.name }, {
      removedFromRoles: holders.map((h) => h.key), removedFromApiClients: clients.map((c) => c.name),
    });
    if (holders.length || clients.length) {
      await this.notifier.send(this.tenant, {
        subject: `Permission archived: ${current.name}`,
        lines: [
          `${this.user.email} archived the custom permission "${current.name}" (${key}).`,
          `Nobody holds it any more. It was in: ${[...holders.map((h) => `role ${h.name}`), ...clients.map((c) => `API client ${c.name}`)].join(', ')}.`,
        ],
        link: '/app/roles',
      });
    }
    return presentCustomPermission(row);
  }

  /** Back in the catalogue, held by nobody (granting it again is an access change). */
  async restore(key: string) {
    const current = await this.row(key);
    if (!current.archivedAt) return presentCustomPermission(current);
    const [row] = await this.db.update(customPermissions).set({ archivedAt: null }).where(and(eq(customPermissions.id, current.id))).returning();
    await this.audit.record(this.tenant.id, this.actor, 'permission.restored', { type: 'permission', id: key, name: current.name });
    return presentCustomPermission(row);
  }
}
