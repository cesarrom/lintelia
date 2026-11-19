import { Injectable, Inject, Scope } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { ACCESS_ADMINISTRATION_PERMISSIONS, SYSTEM_ROLES, TENANT_PERMISSION_IDS, isCustomPermission, resolvePermissions, type Role, type Tenant, type User, type UserInput } from "@repo/fintivio/schemas";
import { AbstractService } from "./service";
import { TENANT } from "../injector/tokens/tenant.token";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { USER } from "../injector/tokens/user.token";
import type { TenantDatabase } from "../clients/database.client";
import { roles, userRoles, users } from "../entities";
import { AuditWriter } from "./audit.writer";
import { ConflictError, ForbiddenError, NotFoundError } from "../http/errors";
import { AccessChanges, actorOf, type SubmitResult } from "../access/changes";
import { activeAssignment, activeCustomKeys, tenantCatalog } from "../access/catalog";
import { AccessNotifier } from "../access/notify";

export { roleKeyFromName } from "../access/change-kinds";

type RoleRow = typeof roles.$inferSelect;

/** Effective permissions of a role row (custom permissions need the institution's active keys). */
export const rolePermissions = (row: Pick<RoleRow, 'key' | 'isSystem' | 'permissions'>, customKeys: readonly string[] = []) =>
  resolvePermissions([row], TENANT_PERMISSION_IDS, undefined, customKeys);

export type RoleView = Role & {
  key: string;
  /** System roles: the custom permissions the institution added to them. */
  customPermissions: string[];
  /** Members holding the role now. */
  members: number;
  /** Holds a permission that administers access (roles, members, security, API clients). */
  privileged: boolean;
};

/**
 * Roles of the current tenant and their assignment (docs/architecture/authorization.md, docs/plans/15). Changes to
 * access go through change control (`AccessChanges`: notification, optional second approver, effective dates);
 * escalation rules are enforced there for every actor. What is left here reads roles and changes their wording.
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
    @Inject(AccessChanges) private readonly changes: AccessChanges,
    @Inject(AccessNotifier) private readonly notifier: AccessNotifier,
  ) {
    super();
  }

  private get actor() {
    return { type: this.user?.kind ?? 'system', id: this.user?.userId, email: this.user?.email };
  }

  private get changeActor() {
    if (!this.user) throw new ForbiddenError();
    return actorOf(this.user);
  }

  private async present(rows: RoleRow[]): Promise<RoleView[]> {
    const customKeys = await activeCustomKeys(this.db);
    const counts = await this.db.select({ roleId: userRoles.roleId, count: sql<number>`count(*)::int` }).from(userRoles)
      .innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .where(and(eq(users.status, 'active'), activeAssignment())).groupBy(userRoles.roleId);
    return rows.map((row) => {
      const permissions = rolePermissions(row, customKeys);
      return {
        // Roles are referenced by key (workflow routing, invitations, SSO mappings), so the key is the public id.
        id: row.key,
        key: row.key,
        name: row.name,
        description: row.description,
        permissions,
        customPermissions: row.isSystem ? row.permissions.filter((p) => isCustomPermission(p) && customKeys.includes(p)) : permissions.filter(isCustomPermission),
        isSystem: row.isSystem,
        members: counts.find((c) => c.roleId === row.id)?.count ?? 0,
        privileged: permissions.some((p) => ACCESS_ADMINISTRATION_PERMISSIONS.includes(p)),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  async listRoles(): Promise<RoleView[]> {
    return this.present(await this.db.select().from(roles).orderBy(asc(roles.name)));
  }

  async getRole(roleId: string): Promise<RoleView | null> {
    const [row] = await this.db.select().from(roles).where(eq(roles.key, roleId)).limit(1);
    return row ? (await this.present([row]))[0] : null;
  }

  /** Built-in catalogue and the institution's custom permissions (archived ones marked). */
  async listPermissions() {
    return tenantCatalog(this.db, { includeArchived: true });
  }

  async createRole(data: { name: string; description?: string; permissions: string[]; effectiveAt?: string }): Promise<SubmitResult<RoleRow>> {
    return this.changes.submit<RoleRow>(this.tenant, this.changeActor, 'role.create',
      { name: data.name, description: data.description ?? '', permissions: data.permissions ?? [] }, { effectiveAt: data.effectiveAt });
  }

  /**
   * Permission changes (and system-role extensions) are access changes; a custom role's name and description are
   * changed at once.
   */
  async updateRole(roleId: string, data: { name?: string; description?: string; permissions?: string[]; customPermissions?: string[]; effectiveAt?: string }): Promise<SubmitResult<RoleRow> | null> {
    const [current] = await this.db.select().from(roles).where(eq(roles.key, roleId));
    if (!current) return null;
    // System roles: `customPermissions` is the extension; `permissions` may be the whole list (platform part unchanged).
    const permissions = data.customPermissions !== undefined && current.isSystem ? data.customPermissions : data.permissions;
    if (current.isSystem && data.customPermissions === undefined && data.permissions !== undefined) {
      // The whole list may be sent back, but the platform's part of a system role cannot change.
      const builtIn = data.permissions.filter((p) => !isCustomPermission(p)).sort();
      const expected = (SYSTEM_ROLES.find((r) => r.key === current.key)?.permissions ?? []).filter((p) => TENANT_PERMISSION_IDS.includes(p)).sort();
      if (builtIn.join() !== expected.join()) {
        throw new ForbiddenError("System roles keep the platform's permissions: only custom permissions can be added to them (or create a custom role)");
      }
    }
    const customKeys = await activeCustomKeys(this.db);
    const currentList = current.isSystem ? current.permissions.filter((p) => customKeys.includes(p)).sort() : [...current.permissions].sort();
    const requested = permissions === undefined ? undefined : [...new Set(current.isSystem ? permissions.filter(isCustomPermission) : permissions)].sort();
    const permissionsChange = requested !== undefined && requested.join() !== currentList.join();
    if (permissionsChange || data.effectiveAt) {
      return this.changes.submit<RoleRow>(this.tenant, this.changeActor, 'role.update',
        { key: roleId, name: data.name, description: data.description, permissions: current.isSystem ? requested : permissions }, { effectiveAt: data.effectiveAt });
    }
    // Wording only.
    if (current.isSystem) {
      if ((data.name !== undefined && data.name.trim() !== current.name) || (data.description !== undefined && data.description !== current.description)) {
        throw new ForbiddenError('System roles cannot be renamed; create a custom role instead');
      }
      return { status: 'applied', change: null as never, result: current };
    }
    const changes: Partial<RoleRow> = {};
    if (data.name !== undefined && data.name.trim()) changes.name = data.name.trim();
    if (data.description !== undefined) changes.description = data.description;
    if (!Object.keys(changes).length) return { status: 'applied', change: null as never, result: current };
    const [row] = await this.db.update(roles).set(changes).where(eq(roles.id, current.id)).returning();
    await this.audit.record(this.tenant.id, this.actor, 'role.updated', { type: 'role', id: roleId }, { fields: Object.keys(changes) });
    return { status: 'applied', change: null as never, result: row };
  }

  async deleteRole(roleId: string, effectiveAt?: string): Promise<SubmitResult | null> {
    const [current] = await this.db.select({ id: roles.id }).from(roles).where(eq(roles.key, roleId));
    if (!current) return null;
    return this.changes.submit(this.tenant, this.changeActor, 'role.delete', { key: roleId }, { effectiveAt });
  }

  /** Replace the roles of a member (optionally until a date per role, or from a date). */
  async setUserRoles(userId: string, roleKeys: string[], options: { expires?: Record<string, string | null>; effectiveAt?: string } = {}) {
    return this.changes.submit(this.tenant, this.changeActor, 'member.roles', { userId, roleKeys, ...(options.expires ? { expires: options.expires } : {}) }, { effectiveAt: options.effectiveAt });
  }

  async inviteMember(input: { email: string; name?: string; roleKeys: string[]; effectiveAt?: string }) {
    return this.changes.submit(this.tenant, this.changeActor, 'member.invite', { email: input.email, name: input.name, roleKeys: input.roleKeys }, { effectiveAt: input.effectiveAt });
  }

  private async assertNotLastAdmin(userId: string) {
    const rows = await this.db.select({ userId: userRoles.userId }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .where(and(eq(roles.key, 'admin'), eq(roles.isSystem, true), eq(users.status, 'active'), activeAssignment()));
    const admins = new Set(rows.map((r) => r.userId));
    if (admins.has(userId) && admins.size <= 1) throw new ConflictError('The last administrator cannot lose the admin role or be deactivated');
  }

  /** Used before deactivating a member. */
  async assertCanRemoveMember(userId: string) {
    if (userId === this.user?.userId) throw new ForbiddenError('You cannot deactivate yourself');
    await this.assertNotLastAdmin(userId);
  }

  /** Deactivating a member who administers access is a revocation: applied at once, and the administrators are told. */
  async memberDeactivated(userId: string, email: string) {
    const customKeys = await activeCustomKeys(this.db);
    const rows = await this.db.select({ key: roles.key, isSystem: roles.isSystem, permissions: roles.permissions }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId))).where(eq(userRoles.userId, userId));
    const permissions = resolvePermissions(rows, TENANT_PERMISSION_IDS, undefined, customKeys);
    if (!permissions.some((p) => ACCESS_ADMINISTRATION_PERMISSIONS.includes(p))) return;
    await this.notifier.send(this.tenant, {
      subject: `Administrator deactivated: ${email}`,
      lines: [`${this.user?.email ?? 'Someone'} deactivated ${email}, who held ${rows.map((r) => r.key).join(', ')}.`, 'Their sessions ended at once.'],
      link: '/app/users',
    });
  }

  async getRolesByUserId({ userId }: UserInput): Promise<string[]> {
    const rows = await this.db.select({ key: roles.key }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(and(eq(userRoles.userId, userId), activeAssignment()));
    if (!rows) throw new NotFoundError('User not found');
    return rows.map((r) => r.key);
  }
}
