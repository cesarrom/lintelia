import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { ACCESS_ADMINISTRATION_PERMISSIONS, type Tenant } from '@repo/lintelia/schemas';
import { roleMappings, roles, tenantSsoSettings, userRoles, users } from '../entities';
import type { Databases, TenantDatabase } from '../clients/database.client';
import { DATABASES } from '../injector/tokens/databases.token';
import { AuditWriter, type AuditActor } from '../services/audit.writer';
import { activeAssignment, activeCustomKeys, rolePermissionsWith } from './catalog';
import { AccessNotifier } from './notify';

/**
 * Roles from the identity provider (docs/plans/15 §5.4, decision 3 as refined in §13): **as soon as single sign-on is
 * linked** (the institution verified an SSO domain), roles of people of that domain come from the IdP's groups — no
 * switch, no exception. Single sign-on is optional for institutions; without it, roles are managed in the app.
 *
 *  - Addresses of a verified SSO domain cannot be given roles by hand (nor invited with roles).
 *  - A member's roles follow their groups from the first time the IdP tells us about them (an SSO sign-in, a directory
 *    event): verifying the domain does not strip the team of its roles before anyone signed in through the IdP.
 *  - The institution maps groups to roles; the app decides what each role may do. No group mapped: the default roles of
 *    just-in-time accounts.
 *  - Members outside the SSO domains (emergency administrators, consultants) are not IdP users: roles by hand.
 *
 * Guards against lock-outs: a sync never removes `admin` from the last active administrator, nor from anyone while no
 * group maps to the Administrator role yet (kept, audited `member.role_sync_blocked`, administrators told).
 */
export const SYNC_ACTOR: AuditActor = { type: 'system', email: 'identity-provider' };

export interface MappingRow { group: string; role: string }
type SsoSettings = typeof tenantSsoSettings.$inferSelect;
type UserRow = typeof users.$inferSelect;

const domainOf = (email: string) => email.trim().toLowerCase().split('@')[1] ?? '';
const norm = (group: string) => group.trim().toLowerCase();

export const groupsOf = (user: Pick<UserRow, 'idpGroups'>) => [...new Set([...(user.idpGroups?.sso ?? []), ...(user.idpGroups?.scim ?? [])])];
/** The IdP told us about this member (SSO sign-in or directory sync). */
export const seenByIdp = (user: Pick<UserRow, 'idpGroups'>) => !!user.idpGroups?.updatedAt;

/** Roles (key → groups that give it) the mappings give to a set of groups. */
export function mappedRoles(mappings: MappingRow[], groups: string[]) {
  const wanted = new Map<string, string[]>();
  const held = new Map(groups.map((g) => [norm(g), g]));
  for (const mapping of mappings) {
    const group = held.get(norm(mapping.group));
    if (group) wanted.set(mapping.role, [...(wanted.get(mapping.role) ?? []), group]);
  }
  return wanted;
}

export interface DesiredAssignment { role: string; source: 'idp' | 'default'; groups: string[] }

/** What a member of an SSO domain should hold: the mapped roles, or the default roles of just-in-time accounts. */
export function desiredAssignments(mappings: MappingRow[], groups: string[], defaults: string[]): DesiredAssignment[] {
  const mapped = mappedRoles(mappings, groups);
  if (mapped.size) return [...mapped].map(([role, from]) => ({ role, source: 'idp' as const, groups: from }));
  return defaults.map((role) => ({ role, source: 'default' as const, groups: [] }));
}

/**
 * One member's roles after a sync, with the guards: `admin` is kept while no group maps to it, and for the last active
 * administrator; roles restored by platform staff stay until removed by hand.
 */
export function planMember(input: {
  mappings: MappingRow[]; groups: string[]; defaults: string[];
  current: Array<{ role: string; source: string }>; active: boolean; otherActiveAdmin: boolean;
}) {
  const desired = desiredAssignments(input.mappings, input.groups, input.defaults);
  const keep = new Set(desired.map((d) => d.role));
  let kept: 'no_admin_mapping' | 'last_admin' | null = null;
  const holdsAdmin = input.current.some((c) => c.role === 'admin');
  if (holdsAdmin && !keep.has('admin')) {
    if (!input.mappings.some((m) => m.role === 'admin')) kept = 'no_admin_mapping';
    else if (input.active && !input.otherActiveAdmin) kept = 'last_admin';
  }
  const removals = input.current.filter((c) => !keep.has(c.role) && c.source !== 'recovery' && !(kept && c.role === 'admin')).map((c) => c.role);
  const next = [...new Set([...desired.map((d) => d.role), ...input.current.filter((c) => !removals.includes(c.role)).map((c) => c.role)])].sort();
  return { desired, removals, next, kept };
}

@Injectable()
export class RoleSync {
  constructor(
    @Inject(DATABASES) private readonly databases: Databases,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(AccessNotifier) private readonly notifier: AccessNotifier,
  ) { }

  private db(tenantId: string) {
    return this.databases.forTenant(tenantId);
  }

  static async settings(db: TenantDatabase): Promise<SsoSettings | null> {
    const [row] = await db.select().from(tenantSsoSettings).limit(1);
    return row ?? null;
  }

  static async mappings(db: TenantDatabase): Promise<MappingRow[]> {
    const rows = await db.select({ group: roleMappings.groupName, role: roles.key }).from(roleMappings)
      .innerJoin(roles, and(eq(roles.id, roleMappings.roleId), eq(roles.tenantId, roleMappings.tenantId)));
    return rows.sort((a, b) => a.group.localeCompare(b.group) || a.role.localeCompare(b.role));
  }

  /** Single sign-on is linked: an organization at the broker with at least one verified domain. */
  static linked(settings: Pick<SsoSettings, 'organizationId' | 'verifiedDomains'> | null) {
    return !!settings?.organizationId && settings.verifiedDomains.length > 0;
  }

  /** The address belongs to a verified SSO domain: its roles come from the IdP (never by hand). */
  static inSsoDomain(settings: Pick<SsoSettings, 'organizationId' | 'verifiedDomains'> | null, email: string) {
    return RoleSync.linked(settings) && settings!.verifiedDomains.includes(domainOf(email));
  }

  /** Roles follow the IdP's groups for this member now (SSO domain, and the IdP told us about them). */
  static managed(settings: Pick<SsoSettings, 'organizationId' | 'verifiedDomains'> | null, user: Pick<UserRow, 'email' | 'idpGroups' | 'kind'>) {
    return user.kind === 'member' && RoleSync.inSsoDomain(settings, user.email) && seenByIdp(user);
  }

  /** Remember the groups the IdP reported (SSO sign-in or directory), then apply them. */
  async recordGroups(tenant: Tenant, userId: string, source: 'sso' | 'scim', groups: string[]) {
    const db = this.db(tenant.id);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;
    const clean = [...new Set(groups.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim()))].sort();
    const idpGroups = { ...(user.idpGroups ?? {}), [source]: clean, updatedAt: new Date().toISOString() };
    await db.update(users).set({ idpGroups }).where(eq(users.id, userId));
    return this.syncMember(tenant, userId, `${source} groups`);
  }

  /** Apply the mappings to one member (no-op unless managed). */
  async syncMember(tenant: Tenant, userId: string, reason: string) {
    const db = this.db(tenant.id);
    const settings = await RoleSync.settings(db);
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !RoleSync.managed(settings, user)) return { changed: false };
    return this.apply(tenant, db, user, await RoleSync.mappings(db), settings!.jitDefaultRoles, reason);
  }

  /** Apply the mappings to every managed member (after the mappings changed). */
  async syncAll(tenant: Tenant, reason: string) {
    const db = this.db(tenant.id);
    const settings = await RoleSync.settings(db);
    if (!RoleSync.linked(settings)) return { members: 0, changed: 0 };
    const mappings = await RoleSync.mappings(db);
    const members = (await db.select().from(users).where(eq(users.kind, 'member'))).filter((u) => RoleSync.managed(settings, u));
    // Members who gain the administrator role first, so nobody is briefly left without one.
    const gainsAdmin = (u: UserRow) => desiredAssignments(mappings, groupsOf(u), settings!.jitDefaultRoles).some((d) => d.role === 'admin');
    members.sort((a, b) => Number(gainsAdmin(b)) - Number(gainsAdmin(a)));
    let changed = 0;
    for (const user of members) if ((await this.apply(tenant, db, user, mappings, settings!.jitDefaultRoles, reason)).changed) changed++;
    return { members: members.length, changed };
  }

  private async apply(tenant: Tenant, db: TenantDatabase, user: UserRow, mappings: MappingRow[], defaults: string[], reason: string) {
    const roleRows = await db.select().from(roles);
    const roleByKey = new Map(roleRows.map((r) => [r.key, r]));
    const current = await db.select({ roleId: userRoles.roleId, source: userRoles.source, groups: userRoles.groups, key: roles.key }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .where(eq(userRoles.userId, user.id));
    const plan = planMember({
      mappings: mappings.filter((m) => roleByKey.has(m.role)), groups: groupsOf(user), defaults: defaults.filter((d) => roleByKey.has(d)),
      current: current.map((c) => ({ role: c.key, source: c.source })), active: user.status === 'active',
      otherActiveAdmin: await this.otherActiveAdmin(db, user.id),
    });
    const removals = current.filter((c) => plan.removals.includes(c.key));
    const additions = plan.desired.filter((d) => !current.some((c) => c.key === d.role));
    const updates = plan.desired.filter((d) => current.some((c) => c.key === d.role && (c.source !== d.source || c.groups.join('|') !== d.groups.join('|'))));
    if (removals.length || additions.length || updates.length) {
      await db.transaction(async (tx) => {
        if (removals.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, user.id), inArray(userRoles.roleId, removals.map((r) => r.roleId))));
        if (additions.length) {
          await tx.insert(userRoles).values(additions.map((d) => ({ userId: user.id, roleId: roleByKey.get(d.role)!.id, source: d.source, groups: d.groups, grantedByEmail: 'identity-provider' })));
        }
        for (const d of updates) {
          await tx.update(userRoles).set({ source: d.source, groups: d.groups, expiresAt: null }).where(and(eq(userRoles.userId, user.id), eq(userRoles.roleId, roleByKey.get(d.role)!.id)));
        }
      });
    }
    const from = current.map((r) => r.key).sort();
    const to = plan.next;
    if (from.join() !== to.join()) {
      await this.audit.record(tenant.id, SYNC_ACTOR, 'member.roles_synced', { type: 'user', id: user.id, email: user.email }, { from, to, groups: groupsOf(user), reason });
      const permissionsOf = rolePermissionsWith(await activeCustomKeys(db));
      const privileged = [...additions.map((d) => d.role), ...removals.map((r) => r.key)]
        .filter((key) => roleByKey.has(key) && permissionsOf(roleByKey.get(key)!).some((p) => ACCESS_ADMINISTRATION_PERMISSIONS.includes(p)));
      if (privileged.length) {
        await this.notifier.send(tenant, {
          subject: `Administrative roles changed by your identity provider for ${user.email}`,
          lines: [
            `Your identity provider's groups changed the roles of ${user.email}.`,
            `Before: ${from.join(', ') || 'no role'}. Now: ${to.join(', ') || 'no role'}.`,
            `Groups: ${groupsOf(user).join(', ') || 'none'}.`,
          ],
        });
      }
    }
    if (plan.kept) await this.reportKept(tenant, user, plan.kept);
    return { changed: from.join() !== to.join(), kept: plan.kept, from, to };
  }

  private async otherActiveAdmin(db: TenantDatabase, userId: string) {
    const rows = await db.select({ userId: userRoles.userId }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)))
      .innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.tenantId, userRoles.tenantId)))
      .where(and(eq(roles.key, 'admin'), eq(roles.isSystem, true), eq(users.status, 'active'), activeAssignment()));
    return rows.some((row) => row.userId !== userId);
  }

  private async reportKept(tenant: Tenant, user: UserRow, why: 'no_admin_mapping' | 'last_admin') {
    await this.audit.record(tenant.id, SYNC_ACTOR, 'member.role_sync_blocked', { type: 'user', id: user.id, email: user.email },
      { kept: 'admin', reason: why === 'last_admin' ? 'last active administrator' : 'no group maps to the Administrator role yet' });
    await this.notifier.send(tenant, {
      subject: `Kept the administrator role of ${user.email}`,
      lines: [
        why === 'last_admin'
          ? `Your identity provider's groups no longer give ${user.email} the administrator role, but they are the last active administrator.`
          : `No group of your identity provider is mapped to the Administrator role yet, so ${user.email} keeps it for now.`,
        'Lintelia kept the role so the institution is not locked out. Map a group of your identity provider to the Administrator role (Settings → Security), and keep an emergency administrator account outside your SSO domains.',
      ],
    });
  }

  /**
   * What members' roles are and would be with these mappings (previews before saving, and the soft-lock check of mapping
   * changes): per member of an SSO domain, their groups, current roles and the roles the mappings give them — now if the
   * IdP already told us about them, at their next sign-in otherwise — and the active administrators afterwards.
   */
  async simulate(tenantId: string, input: { mappings?: MappingRow[] }) {
    const db = this.db(tenantId);
    const settings = await RoleSync.settings(db);
    const mappings = input.mappings ?? await RoleSync.mappings(db);
    const members = await db.select().from(users).where(eq(users.kind, 'member'));
    const assignments = await db.select({ userId: userRoles.userId, key: roles.key, source: userRoles.source }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId))).where(activeAssignment());
    const known = new Set((await db.select({ key: roles.key }).from(roles)).map((r) => r.key));
    const currentAdmins = new Set(assignments.filter((a) => a.key === 'admin').map((a) => a.userId));
    const result = members.map((user) => {
      const current = assignments.filter((a) => a.userId === user.id);
      const sso = RoleSync.inSsoDomain(settings, user.email);
      const seen = seenByIdp(user);
      const plan = sso ? planMember({
        mappings: mappings.filter((m) => known.has(m.role)), groups: groupsOf(user), defaults: (settings?.jitDefaultRoles ?? []).filter((d) => known.has(d)),
        current: current.map((c) => ({ role: c.key, source: c.source })), active: user.status === 'active',
        otherActiveAdmin: [...currentAdmins].some((id) => id !== user.id && members.some((m) => m.id === id && m.status === 'active')),
      }) : null;
      return {
        userId: user.id, email: user.email, status: user.status, managed: sso, seen, groups: groupsOf(user),
        current: current.map((c) => c.key).sort(), next: plan ? plan.next : current.map((c) => c.key).sort(), kept: plan?.kept ?? null,
        changed: !!plan && plan.next.join() !== current.map((c) => c.key).sort().join(),
      };
    });
    // Who administers the institution afterwards: members the IdP knows, by the plan; the others keep what they hold.
    const activeAdmins = result.filter((m) => m.status === 'active' && (m.managed && m.seen ? m.next : m.current).includes('admin'));
    const warnings: string[] = [];
    if (!activeAdmins.length) warnings.push('No active administrator would remain: map a group to the Administrator role, or keep an emergency administrator outside your SSO domains.');
    if (RoleSync.linked(settings) && !mappings.some((m) => m.role === 'admin')) warnings.push('No group is mapped to the Administrator role: administrators keep that role until one is.');
    const roleless = result.filter((m) => m.managed && m.status === 'active' && !m.next.length);
    if (roleless.length) warnings.push(`${roleless.length} member(s) of your SSO domains would have no role (no group of theirs is mapped).`);
    if (RoleSync.linked(settings) && !result.some((m) => m.status === 'active' && !m.managed && m.current.includes('admin'))) {
      warnings.push('Recommended: keep at least one emergency administrator account outside your SSO domains (a local account with a password and a second factor), in case the identity provider is unavailable.');
    }
    return { linked: RoleSync.linked(settings), domains: settings?.verifiedDomains ?? [], members: result, administrators: activeAdmins.map((m) => m.email), warnings };
  }
}
