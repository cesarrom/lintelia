import { Inject, Injectable, Scope } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  TENANT_PERMISSION_IDS, isCustomPermission, normalizeWorkflowAccess, resolvePermissions, satisfiesAccessRule,
  type AccessRule, type Tenant, type WorkflowAccess,
} from '@repo/lintelia/schemas';
import { apiClients, roles, sysWorkflows, userRoles, users, workflowVersions } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { TENANT } from '../injector/tokens/tenant.token';
import { TENANT_CONNECTION } from '../injector/tokens/tenant-connection.token';
import { parseDefinition } from '../engine/definition';
import { BadRequestError, NotFoundError } from '../http/errors';
import { activeAssignment, activeCustomKeys, tenantCatalog } from './catalog';
import { DEFAULT_START_RULE, allows } from './rules';
import { RoleSync, groupsOf, seenByIdp } from './role-sync';

/**
 * "Who sees what" answers for administrators and auditors (docs/plans/15 §6): what a role opens, who holds a
 * permission, what a member can see and do. Read-only; built from the same rules the API enforces.
 */
type Verdict = 'yes' | 'no' | 'conditional';

/** Role keys a step routes work to (`assignTo` / `escalateTo`), including keys inside expressions. */
export function stepRoleKeys(config: Record<string, any>) {
  const keys: Array<{ key: string; how: 'queue' | 'escalation' }> = [];
  for (const [field, how] of [['assignTo', 'queue'], ['escalateTo', 'escalation']] as const) {
    const value = config?.[field]?.role;
    if (typeof value !== 'string' || !value) continue;
    if (value.trim().startsWith('=')) for (const match of value.matchAll(/['"]([a-z][a-z0-9_]*)['"]/g)) keys.push({ key: match[1], how });
    else keys.push({ key: value.trim(), how });
  }
  return keys;
}

@Injectable({ scope: Scope.REQUEST })
export class AccessQueriesService {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: TenantDatabase,
    @Inject(TENANT) private readonly tenant: Tenant,
  ) { }

  private async roleRows() {
    return this.db.select().from(roles).orderBy(asc(roles.name));
  }

  private async activeWorkflows() {
    const rows = await this.db.select({ workflowId: workflowVersions.workflowId, version: workflowVersions.version, yaml: workflowVersions.yaml, access: workflowVersions.access, startOn: workflowVersions.startOn, name: sysWorkflows.name })
      .from(workflowVersions).innerJoin(sysWorkflows, eq(sysWorkflows.id, workflowVersions.workflowId)).where(eq(workflowVersions.status, 'active'));
    return rows.map((row) => ({ ...row, access: normalizeWorkflowAccess(row.access), definition: parseDefinition(row.yaml) }));
  }

  /** Static answer (`conditional` when a condition on attributes decides). */
  private static verdict(rule: AccessRule | undefined, principal: { permissions: string[]; roles: string[] }): Verdict {
    if (!rule) return 'yes';
    if (!satisfiesAccessRule(rule, principal)) return 'no';
    return rule.when ? 'conditional' : 'yes';
  }

  async roleMembers(key: string) {
    const [role] = await this.db.select().from(roles).where(eq(roles.key, key)).limit(1);
    if (!role) throw new NotFoundError('Role not found');
    const rows = await this.db.select({
      userId: users.id, email: users.email, name: users.name, status: users.status, source: userRoles.source, groups: userRoles.groups,
      expiresAt: userRoles.expiresAt, grantedBy: userRoles.grantedByEmail, since: userRoles.createdAt,
    }).from(userRoles).innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .where(and(eq(userRoles.roleId, role.id), activeAssignment())).orderBy(asc(users.email));
    return rows;
  }

  /** What a role opens: task queues and escalations, workflows its holders may start, IdP groups that give it. */
  async roleUsage(key: string) {
    const [role] = await this.db.select().from(roles).where(eq(roles.key, key)).limit(1);
    if (!role) throw new NotFoundError('Role not found');
    const customKeys = await activeCustomKeys(this.db);
    const permissions = resolvePermissions([role], TENANT_PERMISSION_IDS, undefined, customKeys);
    const principal = { permissions, roles: [key] };
    const workflows = (await this.activeWorkflows()).map((wf) => {
      const routed = wf.definition.steps.flatMap((step) => stepRoleKeys(step.config).filter((r) => r.key === key).map((r) => ({ step: step.name, how: r.how })));
      const manual = !wf.startOn.length;
      return {
        id: wf.workflowId, name: wf.name, version: wf.version,
        queues: routed.filter((r) => r.how === 'queue').map((r) => r.step),
        escalations: routed.filter((r) => r.how === 'escalation').map((r) => r.step),
        start: manual ? AccessQueriesService.verdict(wf.access?.start ?? DEFAULT_START_RULE, principal) : 'no' as Verdict,
        cases: AccessQueriesService.verdict(wf.access?.cases, principal),
        gated: !!wf.access,
        mentioned: !!(wf.access?.start?.roles?.includes(key) || wf.access?.cases?.roles?.includes(key)),
      };
    }).filter((wf) => wf.queues.length || wf.escalations.length || wf.start !== 'no' || wf.mentioned);
    const mappings = (await RoleSync.mappings(this.db)).filter((m) => m.role === key).map((m) => m.group);
    const settings = await RoleSync.settings(this.db);
    return {
      role: { key: role.key, name: role.name, isSystem: role.isSystem }, permissions, workflows, groups: mappings,
      justInTimeDefault: !!settings?.jitEnabled && settings.jitDefaultRoles.includes(key),
    };
  }

  /** Everyone and everything holding a permission, and where it is required. */
  async whoCan(permission: string) {
    const catalog = await tenantCatalog(this.db, { includeArchived: true });
    const definition = catalog.find((p) => p.id === permission);
    if (!definition) throw new BadRequestError(`Unknown permission ${permission}`);
    const customKeys = await activeCustomKeys(this.db);
    const roleRows = await this.roleRows();
    const holding = roleRows.filter((row) => resolvePermissions([row], TENANT_PERMISSION_IDS, undefined, customKeys).includes(permission));
    const assignments = await this.db.select({ userId: users.id, email: users.email, name: users.name, status: users.status, role: roles.key, source: userRoles.source })
      .from(userRoles).innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(and(eq(users.status, 'active'), activeAssignment()));
    const members = new Map<string, { userId: string; email: string; name: string; via: Array<{ role: string; source: string }> }>();
    for (const a of assignments) {
      if (!holding.some((r) => r.key === a.role)) continue;
      const entry = members.get(a.userId) ?? { userId: a.userId, email: a.email, name: a.name, via: [] };
      entry.via.push({ role: a.role, source: a.source });
      members.set(a.userId, entry);
    }
    const clients = (await this.db.select({ id: apiClients.id, name: apiClients.name, status: apiClients.status }).from(apiClients).where(sql`${permission} = any(${apiClients.permissions})`))
      .filter((c) => c.status === 'active');
    const workflows = (await this.activeWorkflows())
      .filter((wf) => wf.access?.start?.permissions?.includes(permission) || wf.access?.cases?.permissions?.includes(permission))
      .map((wf) => ({ id: wf.workflowId, name: wf.name, start: !!wf.access?.start?.permissions?.includes(permission), cases: !!wf.access?.cases?.permissions?.includes(permission) }));
    return {
      permission: definition,
      roles: holding.map((r) => ({ key: r.key, name: r.name, isSystem: r.isSystem, members: assignments.filter((a) => a.role === r.key).length })),
      members: [...members.values()].sort((a, b) => a.email.localeCompare(b.email)),
      apiClients: clients.map((c) => ({ id: c.id, name: c.name })),
      workflows,
    };
  }

  /** A member's access: roles (and where each came from), permissions, and what they open. */
  async memberAccess(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.kind !== 'member') throw new NotFoundError('Member not found');
    const rows = await this.db.select({ key: roles.key, name: roles.name, isSystem: roles.isSystem, permissions: roles.permissions, source: userRoles.source, groups: userRoles.groups, expiresAt: userRoles.expiresAt, grantedBy: userRoles.grantedByEmail })
      .from(userRoles).innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(and(eq(userRoles.userId, userId), activeAssignment()));
    const customKeys = await activeCustomKeys(this.db);
    const permissions = resolvePermissions(rows, TENANT_PERMISSION_IDS, undefined, customKeys);
    const roleKeys = rows.map((r) => r.key);
    const subject = { userId: user.id, email: user.email, kind: 'member', roles: roleKeys, permissions, attributes: user.attributes ?? {} };
    const workflows = await this.activeWorkflows();
    const startable: Array<{ id: string; name: string }> = [];
    const hidden: Array<{ id: string; name: string }> = [];
    for (const wf of workflows) {
      if (!wf.startOn.length && await allows(wf.access?.start ?? DEFAULT_START_RULE, subject)) startable.push({ id: wf.workflowId, name: wf.name });
      if (wf.access?.cases && !(await allows(wf.access.cases, subject))) hidden.push({ id: wf.workflowId, name: wf.name });
    }
    const queues = workflows.flatMap((wf) => wf.definition.steps.flatMap((step) => stepRoleKeys(step.config)
      .filter((r) => r.how === 'queue' && roleKeys.includes(r.key)).map((r) => ({ workflow: wf.name, step: step.name, role: r.key }))));
    const settings = await RoleSync.settings(this.db);
    return {
      member: { id: user.id, email: user.email, name: user.name, status: user.status },
      managedByIdp: RoleSync.inSsoDomain(settings, user.email), idpPending: RoleSync.inSsoDomain(settings, user.email) && !seenByIdp(user), groups: groupsOf(user), attributes: user.attributes ?? {},
      roles: rows.map((r) => ({ key: r.key, name: r.name, isSystem: r.isSystem, source: r.source, groups: r.groups, expiresAt: r.expiresAt, grantedBy: r.grantedBy })),
      permissions, customPermissions: permissions.filter(isCustomPermission),
      startable, hiddenWorkflows: hidden, queues,
    };
  }

  /** Roles × permissions for the matrix view and exports. */
  async matrix() {
    const customKeys = await activeCustomKeys(this.db);
    const roleRows = await this.roleRows();
    const catalog = (await tenantCatalog(this.db)).filter((p) => !('archived' in p) || !p.archived);
    return {
      permissions: catalog,
      roles: roleRows.map((r) => ({ key: r.key, name: r.name, isSystem: r.isSystem, permissions: resolvePermissions([r], TENANT_PERMISSION_IDS, undefined, customKeys) })),
    };
  }

  /** Who holds what, for access reviews and auditors: one line per active assignment (CSV). */
  async exportAssignments() {
    const rows = await this.db.select({ email: users.email, name: users.name, status: users.status, role: roles.key, roleName: roles.name, source: userRoles.source, groups: userRoles.groups, expiresAt: userRoles.expiresAt, grantedBy: userRoles.grantedByEmail, since: userRoles.createdAt })
      .from(userRoles).innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(eq(users.kind, 'member')).orderBy(asc(users.email), asc(roles.key));
    const customKeys = await activeCustomKeys(this.db);
    const roleRows = await this.roleRows();
    const permissionsOf = new Map(roleRows.map((r) => [r.key, resolvePermissions([r], TENANT_PERMISSION_IDS, undefined, customKeys)]));
    const cell = (value: unknown) => {
      const text = value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.join(' ') : String(value ?? '');
      // Spreadsheet-safe (no formula injection) and CSV-quoted.
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = ['member', 'name', 'status', 'role', 'role_name', 'source', 'idp_groups', 'expires_at', 'granted_by', 'since', 'permissions'];
    const lines = rows.map((r) => [r.email, r.name, r.status, r.role, r.roleName, r.source, r.groups, r.expiresAt ?? '', r.grantedBy ?? '', r.since, permissionsOf.get(r.role) ?? []].map(cell).join(','));
    return [header.join(','), ...lines].join('\n') + '\n';
  }
}

export type { WorkflowAccess };
