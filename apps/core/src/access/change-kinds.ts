import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import YAML from 'yaml';
import {
  ACCESS_ADMINISTRATION_PERMISSIONS, SYSTEM_ROLES, TENANT_PERMISSION_IDS, accessRuleErrors, isCustomPermission,
  normalizeWorkflowAccess, resolvePermissions, sameAccess, type AccessRule, type WorkflowAccess,
} from '@repo/fintivio/schemas';
import { roleMappings, roles, sysWorkflows, tenantSecurityPolicies, userRoles, users, workflowVersions } from '../entities';
import type { Databases, TenantDatabase } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { AuditWriter } from '../services/audit.writer';
import { IdentityService } from '../auth/identity.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../providers/email.provider';
import { sendMemberInvitation } from '../services/invitations.service';
import { publishWorkflowVersion } from '../services/workflow-publish';
import { parseDefinition } from '../engine/definition';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../http/errors';
import { activeAssignment, activeCustomKeys, grantablePermissionIds, membersHolding, tenantCatalog } from './catalog';
import { AccessChanges, type ChangeActor, type ChangeContext, type ChangeHandler } from './changes';
import { governingWorkflowAccess, workflowAccessErrors, workflowAccessOf } from './rules';

export { workflowAccessErrors, workflowAccessOf };
import { RoleSync, type MappingRow } from './role-sync';

/**
 * The kinds of privileged access changes (docs/plans/15 §14) and their rules. Escalation rules hold for every actor
 * (requester, approver, and the requester again when a change is applied later): you only grant what you hold,
 * only holders of every permission of a role assign it, nobody changes their own roles, the last administrator stays.
 */

export const roleKeyFromName = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

type RoleRow = typeof roles.$inferSelect;

function assertCanGrant(actor: ChangeActor, permissions: string[]) {
  const held = new Set(actor.permissions);
  const missing = [...new Set(permissions)].filter((permission) => !held.has(permission));
  if (missing.length) throw new ForbiddenError(`You cannot grant permissions you do not hold: ${missing.join(', ')}`);
}

const actorOfCtx = (ctx: ChangeContext) => ({ type: ctx.actor.type, id: ctx.actor.id, email: ctx.actor.email });
const privileged = (permissions: string[]) => permissions.some((p) => ACCESS_ADMINISTRATION_PERMISSIONS.includes(p));
const list = (items: string[]) => items.join(', ');

async function rolesWithPermissions(db: TenantDatabase) {
  const customKeys = await activeCustomKeys(db);
  const rows = await db.select().from(roles);
  const permissionsOf = (row: RoleRow) => resolvePermissions([row], TENANT_PERMISSION_IDS, undefined, customKeys);
  return { rows, customKeys, permissionsOf, byKey: new Map(rows.map((row) => [row.key, row])) };
}

async function validPermissions(db: TenantDatabase, permissions: unknown) {
  if (!Array.isArray(permissions)) throw new BadRequestError('permissions must be a list');
  const known = await grantablePermissionIds(db);
  const unknown = permissions.filter((permission) => !known.includes(permission));
  if (unknown.length) throw new BadRequestError(`Unknown permission(s): ${unknown.join(', ')}`);
  return [...new Set(permissions as string[])].sort();
}

/** Roles of people of a verified SSO domain come from the IdP, never by hand (docs/plans/15 §13, decision 3). */
export async function assertNotManagedByIdp(db: TenantDatabase, email: string) {
  const settings = await RoleSync.settings(db);
  if (RoleSync.inSsoDomain(settings, email)) {
    throw new ConflictError(`Roles of members of ${email.split('@')[1]} come from your identity provider: change their groups there, or the group mappings in Settings → Security`);
  }
}

async function activeAdminIds(db: TenantDatabase) {
  const rows = await db.select({ userId: userRoles.userId }).from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
    .innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
    .where(and(eq(roles.key, 'admin'), eq(roles.isSystem, true), eq(users.status, 'active'), activeAssignment()));
  return new Set(rows.map((row) => row.userId));
}

/** Effective permissions of a system role after an edit: its catalogue permissions plus the custom extension. */
function systemRoleEdit(row: RoleRow, requested: string[]) {
  const definition = SYSTEM_ROLES.find((r) => r.key === row.key);
  if (!definition) throw new BadRequestError('Unknown system role');
  if (definition.allCustomPermissions) throw new ForbiddenError('The Administrator role already holds every permission');
  const builtIn = requested.filter((p) => !isCustomPermission(p)).sort();
  const expected = [...definition.permissions].sort();
  if (builtIn.length && builtIn.join() !== expected.join()) {
    throw new ForbiddenError("System roles keep the platform's permissions: only custom permissions can be added to them (or create a custom role)");
  }
  return requested.filter(isCustomPermission).sort();
}

// --- handlers ----------------------------------------------------------------------------------------------------------

interface RoleCreate { name: string; description?: string; permissions: string[] }
interface RoleUpdate { key: string; name?: string; description?: string; permissions?: string[] }
interface MemberRoles { userId: string; roleKeys: string[]; expires?: Record<string, string | null> }
interface MemberInvite { email: string; name?: string; roleKeys: string[] }
interface Mappings { mappings: MappingRow[] }
interface WorkflowPublish { workflowId: string; yaml: string }

@Injectable()
export class AccessChangeKinds implements OnModuleInit {
  constructor(
    @Inject(AccessChanges) private readonly changes: AccessChanges,
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(RoleSync) private readonly roleSync: RoleSync,
  ) { }

  onModuleInit() {
    this.changes.register('role.create', this.roleCreate);
    this.changes.register('role.update', this.roleUpdate);
    this.changes.register('role.delete', this.roleDelete);
    this.changes.register('member.roles', this.memberRoles);
    this.changes.register('member.invite', this.memberInvite);
    this.changes.register('sso.role_mappings', this.mappings);
    this.changes.register('workflow.publish', this.workflowPublish);
    this.changes.register('security.access_policy', this.accessPolicy);
  }

  private readonly roleCreate: ChangeHandler<RoleCreate> = {
    approverPermission: 'roles:manage',
    plan: async ({ db, actor }, payload) => {
      const key = roleKeyFromName(payload.name ?? '');
      if (!key) throw new BadRequestError('Role name is required');
      const permissions = await validPermissions(db, payload.permissions ?? []);
      assertCanGrant(actor, permissions);
      const [existing] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
      if (existing) throw new ConflictError(`A role with key ${key} already exists`);
      return {
        summary: `Create the role "${payload.name.trim()}"${permissions.length ? ` with ${permissions.length} permission(s)` : ''}`,
        diff: { role: key, added: permissions }, grants: permissions.length > 0, notify: true,
      };
    },
    apply: async (ctx, payload, meta) => {
      const key = roleKeyFromName(payload.name);
      const permissions = await validPermissions(ctx.db, payload.permissions ?? []);
      const [row] = await ctx.db.insert(roles).values({ key, name: payload.name.trim(), description: payload.description ?? '', permissions }).returning();
      await this.audit.record(ctx.tenant.id, actorOfCtx(ctx), 'role.created', { type: 'role', id: key, name: row.name }, { permissions, changeId: meta.changeId, approvedBy: meta.approvedBy });
      return row;
    },
  };

  private readonly roleUpdate: ChangeHandler<RoleUpdate> = {
    approverPermission: 'roles:manage',
    plan: async ({ db, actor }, payload) => {
      const { byKey, permissionsOf } = await rolesWithPermissions(db);
      const current = byKey.get(payload.key);
      if (!current) throw new NotFoundError('Role not found');
      if (current.isSystem && (payload.name !== undefined && payload.name.trim() !== current.name || payload.description !== undefined && payload.description !== current.description)) {
        throw new ForbiddenError('System roles cannot be renamed; create a custom role instead');
      }
      const before = permissionsOf(current);
      let stored = current.permissions;
      if (payload.permissions !== undefined) {
        const requested = await validPermissions(db, payload.permissions);
        stored = current.isSystem ? systemRoleEdit(current, requested) : requested;
      }
      const after = permissionsOf({ ...current, permissions: stored });
      const added = after.filter((p) => !before.includes(p));
      const removed = before.filter((p) => !after.includes(p));
      if (added.length || removed.length) {
        // Changing a role is a grant decision on everyone who holds it: you must hold what it had and what it gets.
        assertCanGrant(actor, current.isSystem ? [...added, ...removed] : [...before, ...after]);
      }
      const renamed = !current.isSystem && payload.name !== undefined && payload.name.trim() !== current.name;
      const names = new Map((await tenantCatalog(db, { includeArchived: true })).map((p) => [p.id, p.name]));
      const parts = [...added.map((p) => `+${names.get(p) ?? p}`), ...removed.map((p) => `−${names.get(p) ?? p}`)];
      return {
        summary: `${current.isSystem ? 'System role' : 'Role'} "${current.name}": ${parts.length ? parts.join(', ') : renamed ? `renamed to "${payload.name!.trim()}"` : 'description changed'}`,
        diff: { role: current.key, added, removed, ...(renamed ? { name: { before: current.name, after: payload.name!.trim() } } : {}) },
        grants: added.length > 0, notify: added.length > 0 || removed.length > 0,
      };
    },
    apply: async (ctx, payload, meta) => {
      const { byKey, permissionsOf } = await rolesWithPermissions(ctx.db);
      const current = byKey.get(payload.key)!;
      const changes: Partial<RoleRow> = {};
      if (!current.isSystem && payload.name !== undefined) changes.name = payload.name.trim();
      if (!current.isSystem && payload.description !== undefined) changes.description = payload.description;
      if (payload.permissions !== undefined) {
        const requested = await validPermissions(ctx.db, payload.permissions);
        changes.permissions = current.isSystem ? systemRoleEdit(current, requested) : requested;
      }
      if (!Object.keys(changes).length) return current;
      const before = permissionsOf(current);
      const [row] = await ctx.db.update(roles).set(changes).where(eq(roles.id, current.id)).returning();
      const after = permissionsOf(row);
      await this.audit.record(ctx.tenant.id, actorOfCtx(ctx), 'role.updated', { type: 'role', id: row.key }, {
        fields: Object.keys(changes), added: after.filter((p) => !before.includes(p)), removed: before.filter((p) => !after.includes(p)),
        changeId: meta.changeId, approvedBy: meta.approvedBy,
      });
      return row;
    },
  };

  private readonly roleDelete: ChangeHandler<{ key: string }> = {
    approverPermission: 'roles:manage',
    plan: async ({ db, actor }, payload) => {
      const { byKey, permissionsOf } = await rolesWithPermissions(db);
      const current = byKey.get(payload.key);
      if (!current) throw new NotFoundError('Role not found');
      if (current.isSystem) throw new ForbiddenError('System roles cannot be deleted');
      assertCanGrant(actor, permissionsOf(current));
      const holders = await db.select({ userId: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, current.id));
      return { summary: `Delete the role "${current.name}"${holders.length ? ` (held by ${holders.length} member(s))` : ''}`, diff: { role: current.key, removed: permissionsOf(current), members: holders.length }, grants: false, notify: true };
    },
    apply: async (ctx, payload, meta) => {
      await ctx.db.delete(roles).where(and(eq(roles.key, payload.key), eq(roles.isSystem, false)));
      await this.audit.record(ctx.tenant.id, actorOfCtx(ctx), 'role.deleted', { type: 'role', id: payload.key }, { changeId: meta.changeId, approvedBy: meta.approvedBy });
      return true;
    },
  };

  private readonly memberRoles: ChangeHandler<MemberRoles> = {
    approverPermission: 'roles:manage',
    plan: async ({ db, actor }, payload) => {
      if (payload.userId === actor.id) throw new ForbiddenError('You cannot change your own roles');
      const [target] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (!target || target.kind !== 'member') throw new NotFoundError('User not found');
      await assertNotManagedByIdp(db, target.email);
      const keys = [...new Set(payload.roleKeys ?? [])];
      const { byKey, permissionsOf } = await rolesWithPermissions(db);
      const missing = keys.filter((k) => !byKey.has(k));
      if (missing.length) throw new BadRequestError(`Unknown role(s): ${missing.join(', ')}`);
      for (const [key, at] of Object.entries(payload.expires ?? {})) {
        if (!keys.includes(key) || !at) continue;
        const date = new Date(at);
        if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new BadRequestError(`The end of the ${key} role must be a date in the future`);
      }
      const current = await db.select({ key: roles.key }).from(userRoles)
        .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId))).where(eq(userRoles.userId, payload.userId));
      const before = current.map((r) => r.key);
      const added = keys.filter((k) => !before.includes(k));
      const removed = before.filter((k) => !keys.includes(k));
      // Assigning needs every permission of the new roles; removing one needs every permission of what is removed.
      assertCanGrant(actor, resolvePermissions(keys.map((k) => byKey.get(k)!), TENANT_PERMISSION_IDS, undefined, await activeCustomKeys(db)));
      assertCanGrant(actor, removed.flatMap((k) => permissionsOf(byKey.get(k)!)));
      if (removed.includes('admin') && target.status === 'active') {
        const admins = await activeAdminIds(db);
        if (admins.has(target.id) && admins.size <= 1) throw new ConflictError('The last administrator cannot lose the admin role or be deactivated');
      }
      const names = (k: string) => byKey.get(k)?.name ?? k;
      const parts = [...added.map((k) => `+${names(k)}${payload.expires?.[k] ? ` until ${String(payload.expires[k]).slice(0, 10)}` : ''}`), ...removed.map((k) => `−${names(k)}`)];
      return {
        summary: `${target.email}: ${parts.length ? parts.join(', ') : 'roles unchanged'}`,
        diff: { member: target.email, before, after: keys, added, removed, expires: payload.expires ?? {} },
        grants: added.length > 0,
        notify: [...added, ...removed].some((k) => privileged(permissionsOf(byKey.get(k)!))),
      };
    },
    apply: async (ctx, payload, meta) => {
      const keys = [...new Set(payload.roleKeys ?? [])];
      const rows = keys.length ? await ctx.db.select().from(roles).where(inArray(roles.key, keys)) : [];
      const current = await ctx.db.select({ key: roles.key, roleId: userRoles.roleId }).from(userRoles)
        .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId))).where(eq(userRoles.userId, payload.userId));
      const expiry = (key: string) => (payload.expires?.[key] ? new Date(payload.expires[key]!) : null);
      await ctx.db.transaction(async (tx) => {
        const removedIds = current.filter((r) => !keys.includes(r.key)).map((r) => r.roleId);
        if (removedIds.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, payload.userId), inArray(userRoles.roleId, removedIds)));
        for (const row of rows) {
          if (current.some((c) => c.roleId === row.id)) {
            if (payload.expires && row.key in payload.expires) await tx.update(userRoles).set({ expiresAt: expiry(row.key) }).where(and(eq(userRoles.userId, payload.userId), eq(userRoles.roleId, row.id)));
          } else {
            await tx.insert(userRoles).values({ userId: payload.userId, roleId: row.id, source: 'manual', expiresAt: expiry(row.key), grantedByEmail: ctx.actor.email });
          }
        }
      });
      await this.audit.record(ctx.tenant.id, actorOfCtx(ctx), 'member.roles_changed', { type: 'user', id: payload.userId }, {
        from: current.map((r) => r.key), to: keys, ...(payload.expires && Object.keys(payload.expires).length ? { expires: payload.expires } : {}),
        changeId: meta.changeId, approvedBy: meta.approvedBy,
      });
      return true;
    },
  };

  private readonly memberInvite: ChangeHandler<MemberInvite> = {
    approverPermission: 'roles:manage',
    plan: async ({ db, actor }, payload) => {
      const email = String(payload.email ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError('A valid e-mail address is required');
      const keys = [...new Set(payload.roleKeys ?? [])];
      if (keys.length) await assertNotManagedByIdp(db, email);
      const { byKey, permissionsOf } = await rolesWithPermissions(db);
      const missing = keys.filter((k) => !byKey.has(k));
      if (missing.length) throw new BadRequestError(`Unknown role(s): ${missing.join(', ')}`);
      assertCanGrant(actor, keys.flatMap((k) => permissionsOf(byKey.get(k)!)));
      return {
        summary: `Invite ${email}${keys.length ? ` as ${keys.map((k) => byKey.get(k)!.name).join(', ')}` : ''}`,
        diff: { member: email, added: keys }, grants: keys.length > 0, notify: keys.some((k) => privileged(permissionsOf(byKey.get(k)!))),
      };
    },
    apply: async (ctx, payload) => sendMemberInvitation({ databases: this.databases, identity: this.identity, email: this.email, audit: this.audit }, ctx.tenant,
      { email: payload.email.trim(), name: payload.name, roleKeys: [...new Set(payload.roleKeys ?? [])] }, actorOfCtx(ctx)),
  };

  private async normalizeMappings(db: TenantDatabase, input: unknown): Promise<MappingRow[]> {
    if (!Array.isArray(input)) throw new BadRequestError('mappings must be a list of { group, role }');
    const known = new Set((await db.select({ key: roles.key }).from(roles)).map((r) => r.key));
    const seen = new Set<string>();
    const result: MappingRow[] = [];
    for (const raw of input as Array<Record<string, unknown>>) {
      const group = String(raw?.group ?? '').trim();
      const role = String(raw?.role ?? '').trim();
      if (!group || group.length > 255) throw new BadRequestError('Each mapping needs a group name (at most 255 characters)');
      if (!known.has(role)) throw new BadRequestError(`Unknown role: ${role || '(empty)'}`);
      const id = `${group.toLowerCase()}→${role}`;
      if (!seen.has(id)) result.push({ group, role });
      seen.add(id);
    }
    return result.sort((a, b) => a.group.localeCompare(b.group) || a.role.localeCompare(b.role));
  }

  private readonly mappings: ChangeHandler<Mappings> = {
    approverPermission: 'security:manage',
    plan: async ({ tenant, db, actor }, payload) => {
      const next = await this.normalizeMappings(db, payload.mappings);
      const before = await RoleSync.mappings(db);
      const key = (m: MappingRow) => `${m.group.toLowerCase()}→${m.role}`;
      const added = next.filter((m) => !before.some((b) => key(b) === key(m)));
      const removed = before.filter((b) => !next.some((m) => key(m) === key(b)));
      const { byKey, permissionsOf } = await rolesWithPermissions(db);
      // Mapping a group to a role hands the role to everyone in the group: only whoever could assign the role may.
      assertCanGrant(actor, [...added, ...removed].flatMap((m) => permissionsOf(byKey.get(m.role)!)));
      const settings = await RoleSync.settings(db);
      if (RoleSync.linked(settings)) {
        const outcome = await this.roleSync.simulate(tenant.id, { mappings: next });
        if (!outcome.administrators.length) throw new ConflictError(outcome.warnings[0]);
      }
      const parts = [...added.map((m) => `+ ${m.group} → ${byKey.get(m.role)!.name}`), ...removed.map((m) => `− ${m.group} → ${byKey.get(m.role)!.name}`)];
      return {
        summary: `Identity provider groups: ${parts.length ? parts.join('; ') : 'no change'}`,
        diff: { added, removed, after: next }, grants: added.length > 0, notify: parts.length > 0,
      };
    },
    apply: async (ctx, payload, meta) => {
      const next = await this.normalizeMappings(ctx.db, payload.mappings);
      const roleRows = await ctx.db.select({ id: roles.id, key: roles.key }).from(roles);
      await ctx.db.transaction(async (tx) => {
        await tx.delete(roleMappings);
        if (next.length) await tx.insert(roleMappings).values(next.map((m) => ({ groupName: m.group, roleId: roleRows.find((r) => r.key === m.role)!.id, createdByEmail: ctx.actor.email })));
      });
      await this.audit.record(ctx.tenant.id, actorOfCtx(ctx), 'sso.role_mappings_changed', { type: 'tenant', id: ctx.tenant.id }, { mappings: next, changeId: meta.changeId, approvedBy: meta.approvedBy });
      return this.roleSync.syncAll(ctx.tenant, 'group mappings changed');
    },
  };

  private readonly workflowPublish: ChangeHandler<WorkflowPublish> = {
    approverPermission: 'roles:manage',
    plan: async ({ db, actor }, payload) => {
      const [workflow] = await db.select().from(sysWorkflows).where(eq(sysWorkflows.id, payload.workflowId)).limit(1);
      if (!workflow) throw new NotFoundError('Workflow not found');
      const access = workflowAccessOf(payload.yaml);
      const errors = await workflowAccessErrors(db, access);
      if (errors.length) throw new BadRequestError(errors.join('; '));
      const before = (await governingWorkflowAccess(db)).get(payload.workflowId) ?? null;
      const [latest] = await db.select({ version: workflowVersions.version }).from(workflowVersions).where(eq(workflowVersions.workflowId, payload.workflowId)).orderBy(desc(workflowVersions.version)).limit(1);
      const name = parseDefinition(payload.yaml).name;
      return {
        summary: `Publish "${name}" (version ${(latest?.version ?? 0) + 1}) — ${describeAccessChange(before, access)}`,
        diff: { workflow: name, before, after: access },
        grants: !sameAccess(before, access), notify: !sameAccess(before, access),
        // Who may use a workflow is an administrator's decision, whoever designs it.
        forceApproval: !actor.permissions.includes('roles:manage'),
      };
    },
    apply: async (ctx, payload, meta) => publishWorkflowVersion(ctx.db, this.audit, ctx.tenant.id, actorOfCtx(ctx), payload.workflowId, payload.yaml, { changeId: meta.changeId, approvedBy: meta.approvedBy }),
  };
  /** Who approves and hears about access changes (the institution's change-control policy). */
  private readonly accessPolicy: ChangeHandler<{ approval?: 'off' | 'grants'; notify?: string[] }> = {
    approverPermission: 'security:manage',
    plan: async ({ db }, payload) => {
      const [current] = await db.select().from(tenantSecurityPolicies).limit(1);
      const before = { approval: current?.accessApproval ?? 'off', notify: current?.accessNotify ?? [] };
      const approval = payload.approval ?? before.approval;
      if (approval !== 'off' && approval !== 'grants') throw new BadRequestError('accessApproval must be off or grants');
      const notify = payload.notify === undefined ? before.notify : payload.notify;
      if (!Array.isArray(notify) || notify.some((e) => typeof e !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw new BadRequestError('accessNotify must be a list of e-mail addresses');
      if (notify.length > 20) throw new BadRequestError('At most 20 extra addresses');
      if (approval === 'grants' && before.approval !== 'grants') {
        // A second approver needs a second person who can approve: refuse rather than lock the institution.
        const approvers = await membersHolding(db, 'roles:manage');
        if (approvers.length < 2) throw new ConflictError('A second approver needs at least two active members who can manage roles');
      }
      const weakens = before.approval === 'grants' && approval === 'off';
      const parts = [
        ...(approval !== before.approval ? [approval === 'grants' ? 'access changes that grant something now need a second administrator' : 'access changes no longer need a second administrator'] : []),
        ...(notify.join() !== before.notify.join() ? [`extra addresses told about access changes: ${notify.join(', ') || 'none'}`] : []),
      ];
      return { summary: `Access change policy: ${parts.join('; ') || 'unchanged'}`, diff: { before, after: { approval, notify } }, grants: weakens, notify: parts.length > 0 };
    },
    apply: async (ctx, payload, meta) => {
      const changes = { ...(payload.approval ? { accessApproval: payload.approval } : {}), ...(payload.notify ? { accessNotify: payload.notify.map((e) => e.trim().toLowerCase()) } : {}), updatedByEmail: ctx.actor.email };
      await ctx.db.insert(tenantSecurityPolicies).values(changes).onConflictDoUpdate({ target: tenantSecurityPolicies.tenantId, set: changes });
      await this.audit.record(ctx.tenant.id, actorOfCtx(ctx), 'security.access_policy_changed', { type: 'tenant', id: ctx.tenant.id }, { ...payload, changeId: meta.changeId, approvedBy: meta.approvedBy });
      return true;
    },
  };
}

// --- workflow access helpers -------------------------------------------------------------------------------------------

const describeRule = (rule: AccessRule | undefined, fallback: string) => {
  if (!rule) return fallback;
  const parts = [
    ...(rule.permissions?.length ? [`holders of ${list(rule.permissions)}`] : []),
    ...(rule.roles?.length ? [`roles ${list(rule.roles)}`] : []),
    ...(rule.when ? [`when ${rule.when}`] : []),
  ];
  return parts.join(', ') || 'every member';
};

export function describeAccessChange(before: WorkflowAccess | null, after: WorkflowAccess | null) {
  if (sameAccess(before, after)) return 'who may use it unchanged';
  const parts: string[] = [];
  if (!sameAccess(before?.start, after?.start)) parts.push(`who may start it: ${describeRule(before?.start, 'cases:create')} → ${describeRule(after?.start, 'cases:create')}`);
  if (!sameAccess(before?.cases, after?.cases)) parts.push(`who may see its cases: ${describeRule(before?.cases, 'case scope')} → ${describeRule(after?.cases, 'case scope')}`);
  return parts.join('; ');
}
