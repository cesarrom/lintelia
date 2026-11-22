import { and, asc, eq, gt, isNull, or } from 'drizzle-orm';
import {
  TENANT_PERMISSION_CATALOG, TENANT_PERMISSION_IDS, isCustomPermission, resolvePermissions,
  type CustomPermissionDefinition, type PermissionDefinition,
} from '@repo/lintelia/schemas';
import { customPermissions, roles, userRoles, users } from '../entities';
import type { TenantDatabase } from '../clients/database.client';

/**
 * The permission catalogue of one institution (docs/plans/15 §5.1): the platform's built-in permissions plus the
 * custom permissions the institution named. Archived custom permissions stay listed (for history) but grant nothing.
 */
type CustomRow = typeof customPermissions.$inferSelect;

export const presentCustomPermission = (row: CustomRow): CustomPermissionDefinition => ({
  id: row.key, name: row.name, description: row.description, category: row.category, custom: true,
  archived: !!row.archivedAt, createdBy: row.createdByEmail, createdAt: row.createdAt,
});

export async function customPermissionRows(db: TenantDatabase, options: { includeArchived?: boolean } = {}) {
  const rows = await db.select().from(customPermissions).orderBy(asc(customPermissions.category), asc(customPermissions.name));
  return options.includeArchived ? rows : rows.filter((row) => !row.archivedAt);
}

/** Keys of the custom permissions that currently grant something. */
export async function activeCustomKeys(db: TenantDatabase) {
  const rows = await db.select({ key: customPermissions.key }).from(customPermissions).where(isNull(customPermissions.archivedAt));
  return rows.map((row) => row.key);
}

export async function tenantCatalog(db: TenantDatabase, options: { includeArchived?: boolean } = {}): Promise<Array<PermissionDefinition | CustomPermissionDefinition>> {
  return [...TENANT_PERMISSION_CATALOG, ...(await customPermissionRows(db, options)).map(presentCustomPermission)];
}

/** Every id a role may contain right now (built-in + active custom). */
export async function grantablePermissionIds(db: TenantDatabase) {
  return [...TENANT_PERMISSION_IDS, ...(await activeCustomKeys(db))];
}

/** Role assignments that count now (time-bound ones end at `expires_at`). */
export const activeAssignment = () => or(isNull(userRoles.expiresAt), gt(userRoles.expiresAt, new Date()));

/** Effective permissions of a role row, given the active custom keys. */
export const rolePermissionsWith = (customKeys: readonly string[]) =>
  (row: { key: string; isSystem: boolean; permissions: string[] }) => resolvePermissions([row], TENANT_PERMISSION_IDS, undefined, customKeys);

/** A member's roles (active assignments) and effective permissions, in one round trip per table. */
export async function memberAccess(db: TenantDatabase, userId: string) {
  const roleRows = await db.select({ key: roles.key, isSystem: roles.isSystem, permissions: roles.permissions }).from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
    .where(and(eq(userRoles.userId, userId), activeAssignment()));
  const customKeys = roleRows.some((row) => row.isSystem && row.key === 'admin') || roleRows.some((row) => row.permissions.some(isCustomPermission))
    ? await activeCustomKeys(db) : [];
  return { roleKeys: roleRows.map((row) => row.key), permissions: resolvePermissions(roleRows, TENANT_PERMISSION_IDS, undefined, customKeys), customKeys };
}

/**
 * Active members with their roles and effective permissions (administrators to notify, approvers, "who can" answers).
 * One query for every assignment of the institution: fine for teams of thousands.
 */
export async function membersWithAccess(db: TenantDatabase) {
  const rows = await db.select({
    userId: users.id, email: users.email, name: users.name, status: users.status,
    key: roles.key, isSystem: roles.isSystem, permissions: roles.permissions,
  }).from(users)
    .leftJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.tenantId, users.tenantId), activeAssignment()))
    .leftJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
    .where(and(eq(users.kind, 'member'), eq(users.status, 'active')));
  const customKeys = await activeCustomKeys(db);
  const byUser = new Map<string, { userId: string; email: string; name: string; roles: Array<{ key: string; isSystem: boolean; permissions: string[] }> }>();
  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? { userId: row.userId, email: row.email, name: row.name, roles: [] };
    if (row.key) entry.roles.push({ key: row.key, isSystem: !!row.isSystem, permissions: row.permissions ?? [] });
    byUser.set(row.userId, entry);
  }
  return [...byUser.values()].map((member) => ({
    userId: member.userId, email: member.email, name: member.name, roles: member.roles.map((r) => r.key),
    permissions: resolvePermissions(member.roles, TENANT_PERMISSION_IDS, undefined, customKeys),
  }));
}

export async function membersHolding(db: TenantDatabase, permission: string) {
  return (await membersWithAccess(db)).filter((member) => member.permissions.includes(permission));
}
