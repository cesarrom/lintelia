import { Injectable, Inject, Scope } from "@nestjs/common";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { TENANT_PERMISSION_CATALOG, TENANT_PERMISSION_IDS, resolvePermissions, type Permission, type Role, type Tenant, type User, type UserInput, type UserRoleInput } from "@repo/fintivio/schemas";
import { AbstractService } from "./service";
import { TENANT } from "../injector/tokens/tenant.token";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { USER } from "../injector/tokens/user.token";
import type { TenantDatabase } from "../clients/database.client";
import { roles, userRoles, users } from "../entities";
import { AuditWriter } from "./audit.writer";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../http/errors";

type RoleRow = typeof roles.$inferSelect;

/** Effective permissions of a role row: system roles from the catalogue, custom roles from the database. */
export const rolePermissions = (row: Pick<RoleRow, 'key' | 'isSystem' | 'permissions'>) => resolvePermissions([row]);

const toRole = (row: RoleRow): Role => ({
  // Roles are referenced by key (workflow routing, invitations, SSO mappings), so the key is the public id.
  id: row.key,
  name: row.name,
  description: row.description,
  permissions: rolePermissions(row),
  isSystem: row.isSystem,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const roleKeyFromName = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * Roles of the current tenant and their assignment (docs/architecture/authorization.md). Escalation rules: custom
 * roles only use catalogue permissions; nobody creates, changes or assigns a role with permissions they do not hold;
 * nobody changes their own roles; the last administrator keeps the admin role.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class RolesService extends AbstractService {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: TenantDatabase,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User | null,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) {
    super();
  }

  private get actor() {
    return { type: this.user?.kind ?? 'system', id: this.user?.userId, email: this.user?.email };
  }

  /** The caller may only hand out permissions they hold themselves. */
  private assertCanGrant(permissions: string[]) {
    const held = new Set(this.user?.permissions ?? []);
    const missing = permissions.filter((permission) => !held.has(permission));
    if (missing.length) throw new ForbiddenError(`You cannot grant permissions you do not hold: ${missing.join(', ')}`);
  }

  private validatePermissions(permissions: unknown): string[] {
    if (!Array.isArray(permissions)) throw new BadRequestError('permissions must be a list');
    const unknown = permissions.filter((permission) => !TENANT_PERMISSION_IDS.includes(permission));
    if (unknown.length) throw new BadRequestError(`Unknown permission(s): ${unknown.join(', ')}`);
    return [...new Set(permissions as string[])];
  }

  async createRole(data: { name: string; description?: string; permissions: string[] }): Promise<Role> {
    const key = roleKeyFromName(data.name ?? '');
    if (!key) throw new BadRequestError('Role name is required');
    const permissions = this.validatePermissions(data.permissions ?? []);
    this.assertCanGrant(permissions);
    const [existing] = await this.db.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
    if (existing) throw new ConflictError(`A role with key ${key} already exists`);

    const [row] = await this.db.insert(roles).values({ key, name: data.name.trim(), description: data.description ?? '', permissions }).returning();
    await this.audit.record(this.tenant.id, this.actor, 'role.created', { type: 'role', id: key, name: row.name }, { permissions });
    return toRole(row);
  }

  async updateRole(roleId: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<Role | null> {
    const [current] = await this.db.select().from(roles).where(eq(roles.key, roleId));
    if (!current) return null;
    if (current.isSystem) throw new ForbiddenError('System roles cannot be changed; create a custom role instead');
    const changes: Partial<RoleRow> = {};
    if (data.name !== undefined) changes.name = data.name.trim();
    if (data.description !== undefined) changes.description = data.description;
    if (data.permissions !== undefined) {
      changes.permissions = this.validatePermissions(data.permissions);
      this.assertCanGrant([...changes.permissions, ...current.permissions]);
    }
    const [row] = await this.db.update(roles).set(changes).where(eq(roles.key, roleId)).returning();
    await this.audit.record(this.tenant.id, this.actor, 'role.updated', { type: 'role', id: roleId }, { fields: Object.keys(changes) });
    return toRole(row);
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const [current] = await this.db.select().from(roles).where(eq(roles.key, roleId));
    if (!current) return false;
    if (current.isSystem) throw new ForbiddenError('System roles cannot be deleted');
    this.assertCanGrant(current.permissions);
    await this.db.delete(roles).where(eq(roles.key, roleId));
    await this.audit.record(this.tenant.id, this.actor, 'role.deleted', { type: 'role', id: roleId });
    return true;
  }

  async getRole(roleId: string): Promise<Role | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.key, roleId)).limit(1);
    return row ? toRole(row) : null;
  }

  async listRoles(): Promise<Role[]> {
    const rows = await this.db.select().from(roles).orderBy(asc(roles.name));
    return rows.map(toRole);
  }

  async listPermissions(): Promise<Permission[]> {
    return TENANT_PERMISSION_CATALOG;
  }

  private async roleRows(keys: string[]) {
    if (!keys.length) return [];
    const rows = await this.db.select().from(roles).where(inArray(roles.key, keys));
    const missing = keys.filter((key) => !rows.some((row) => row.key === key));
    if (missing.length) throw new BadRequestError(`Unknown role(s): ${missing.join(', ')}`);
    return rows;
  }

  /** Check the caller may assign these roles (used for invitations too). */
  async assertCanAssign(roleKeys: string[]) {
    const rows = await this.roleRows(roleKeys);
    this.assertCanGrant(resolvePermissions(rows));
    return rows;
  }

  private async assertNotLastAdmin(userId: string) {
    const [adminRole] = await this.db.select().from(roles).where(and(eq(roles.key, 'admin'), eq(roles.isSystem, true)));
    if (!adminRole) return;
    const admins = await this.db.select({ userId: userRoles.userId }).from(userRoles)
      .innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .where(and(eq(userRoles.roleId, adminRole.id), eq(users.status, 'active'), ne(users.id, userId)));
    const isAdmin = (await this.db.select().from(userRoles).where(and(eq(userRoles.roleId, adminRole.id), eq(userRoles.userId, userId)))).length > 0;
    if (isAdmin && admins.length === 0) throw new ConflictError('The last administrator cannot lose the admin role or be deactivated');
  }

  /** Used before deactivating a member. */
  async assertCanRemoveMember(userId: string) {
    if (userId === this.user?.userId) throw new ForbiddenError('You cannot deactivate yourself');
    await this.assertNotLastAdmin(userId);
  }

  async createUserRole({ userId, roleId }: UserRoleInput) {
    if (userId === this.user?.userId) throw new ForbiddenError('You cannot change your own roles');
    const [role] = await this.assertCanAssign([roleId]);
    await this.db.insert(userRoles).values({ userId, roleId: role.id }).onConflictDoNothing();
    await this.audit.record(this.tenant.id, this.actor, 'member.role_assigned', { type: 'user', id: userId }, { role: roleId });
    return true;
  }

  async deleteUserRole({ roleId, userId }: UserRoleInput) {
    if (userId === this.user?.userId) throw new ForbiddenError('You cannot change your own roles');
    const [role] = await this.db.select().from(roles).where(eq(roles.key, roleId)).limit(1);
    if (!role) return false;
    this.assertCanGrant(rolePermissions(role));
    if (roleId === 'admin') await this.assertNotLastAdmin(userId);
    await this.db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));
    await this.audit.record(this.tenant.id, this.actor, 'member.role_removed', { type: 'user', id: userId }, { role: roleId });
    return true;
  }

  /** Replace the roles of a user with the given role keys. */
  async setUserRoles(userId: string, roleKeys: string[]) {
    if (userId === this.user?.userId) throw new ForbiddenError('You cannot change your own roles');
    const [target] = await this.db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!target) throw new NotFoundError('User not found');
    const next = await this.assertCanAssign(roleKeys);
    const currentRows = await this.db.select({ key: roles.key, isSystem: roles.isSystem, permissions: roles.permissions }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId))).where(eq(userRoles.userId, userId));
    // Removing roles is also a grant decision: you cannot strip permissions you do not hold yourself.
    this.assertCanGrant(resolvePermissions(currentRows.filter((r) => !roleKeys.includes(r.key))));
    if (currentRows.some((r) => r.key === 'admin') && !roleKeys.includes('admin')) await this.assertNotLastAdmin(userId);

    await this.db.transaction(async (tx) => {
      await tx.delete(userRoles).where(eq(userRoles.userId, userId));
      if (next.length) await tx.insert(userRoles).values(next.map((r) => ({ userId, roleId: r.id })));
    });
    await this.audit.record(this.tenant.id, this.actor, 'member.roles_changed', { type: 'user', id: userId }, { from: currentRows.map((r) => r.key), to: roleKeys });
  }

  async getRolesByUserId({ userId }: UserInput): Promise<string[]> {
    const rows = await this.db.select({ key: roles.key }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.key);
  }
}

