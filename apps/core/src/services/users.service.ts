import { Injectable, Inject, Scope } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";
import { InviteUserInput, UserResponse as User, type Tenant } from "@repo/fintivio/schemas";
import { LogsService } from "./logs.service";
import { AbstractService } from "./service";
import { RolesService } from "./roles.service";
import { InvitationsService } from "./invitations.service";
import { TENANT } from "../injector/tokens/tenant.token";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import type { TenantDatabase } from "../clients/database.client";
import { roles, userRoles, users } from "../entities";
import { IdentityService } from "../auth/identity.service";
import { USER } from "../injector/tokens/user.token";
import type { User as Principal } from "@repo/fintivio/schemas";
import { AuditWriter } from "./audit.writer";
import { NotFoundError } from "../http/errors";
import { activeAssignment } from "../access/catalog";
import { RoleSync, seenByIdp } from "../access/role-sync";

type UserRow = typeof users.$inferSelect;

/**
 * Users of the current tenant (members and clients), stored in Postgres (replaces Descope user management).
 * All queries use the tenant-scoped connection.
 */
@Injectable({
  scope: Scope.REQUEST
})
export class UsersService extends AbstractService {
  constructor(
    @Inject(TENANT_CONNECTION) private readonly db: TenantDatabase,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(LogsService) private readonly logs: LogsService,
    @Inject(RolesService) private readonly rolesService: RolesService,
    @Inject(InvitationsService) private readonly invitations: InvitationsService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(USER) private readonly principal: Principal | null,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
  ) {
    super();
  }

  private async withRoles(rows: UserRow[]): Promise<User[]> {
    if (!rows.length) return [];
    const assignments = await this.db.select({ userId: userRoles.userId, key: roles.key, source: userRoles.source, groups: userRoles.groups, expiresAt: userRoles.expiresAt })
      .from(userRoles).innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId))).where(activeAssignment());
    // Members of the SSO domains get their roles from the IdP when the institution says so (docs/plans/15 §5.4).
    const sso = await RoleSync.settings(this.db);
    return rows.map((row) => {
      const mine = assignments.filter((a) => a.userId === row.id);
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        picture: row.picture ?? undefined,
        roles: mine.map((a) => a.key),
        /** How each role was given: by hand, by the IdP's groups, by default (just in time), by staff recovery; and until when. */
        assignments: mine.map((a) => ({ role: a.key, source: a.source, groups: a.groups, expiresAt: a.expiresAt })),
        managedByIdp: row.kind === 'member' && RoleSync.inSsoDomain(sso, row.email),
        /** SSO domain, but the IdP has not told us about them yet: their roles follow their groups at their next sign-in. */
        idpPending: row.kind === 'member' && RoleSync.inSsoDomain(sso, row.email) && !seenByIdp(row),
        attributes: row.kind === 'member' ? row.attributes ?? {} : undefined,
        kind: row.kind,
        status: row.status === 'active' ? 'active' as const : 'inactive' as const,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.email));
    return this.withRoles(rows);
  }

  private get actor() {
    return { type: this.principal?.kind ?? 'system', id: this.principal?.userId, email: this.principal?.email };
  }

  /**
   * Invite a member. With roles, it is an access change (escalation rules, notification, approval when the policy asks
   * for it); without roles it is sent at once (roles come later, e.g. from the identity provider).
   */
  async inviteUser({ email, name, roleIds = [], effectiveAt }: InviteUserInput & { effectiveAt?: string }) {
    if (!roleIds.length && !effectiveAt) {
      await this.invitations.createInvitation(email, '', this.tenant.domain, name, []);
      return { status: 'applied' as const, change: null, result: true };
    }
    return this.rolesService.inviteMember({ email, name, roleKeys: roleIds, effectiveAt });
  }

  private async setStatus(userId: string, status: 'active' | 'disabled', action: string) {
    const [row] = await this.db.update(users).set({ status }).where(eq(users.id, userId)).returning({ id: users.id, kind: users.kind, email: users.email });
    if (!row) throw new NotFoundError('User not found');
    if (status === 'disabled') await this.identity.revokeUserSessions(row.kind, this.tenant.id, userId);
    await this.audit.record(this.tenant.id, this.actor, action, { type: 'user', id: userId, email: row.email });
    return true;
  }

  async deactivateUser(userId: string): Promise<boolean> {
    await this.rolesService.assertCanRemoveMember(userId);
    const [row] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    const done = await this.setStatus(userId, 'disabled', 'member.deactivated');
    // A revocation: at once, never waiting for an approval; administrators hear about it when it was one of them.
    if (row) await this.rolesService.memberDeactivated(userId, row.email);
    return done;
  }

  async activateUser(userId: string): Promise<boolean> {
    return this.setStatus(userId, 'active', 'member.reactivated');
  }

  /** Invalidates the password, ends the member's sessions and e-mails a link to choose a new one. */
  async resetPassword(userId: string): Promise<boolean> {
    const [row] = await this.db.update(users).set({ passwordHash: null }).where(eq(users.id, userId)).returning();
    if (!row) throw new NotFoundError('User not found');
    await this.identity.revokeUserSessions(row.kind, this.tenant.id, userId);
    await this.identity.sendPasswordReset(this.tenant, userId, row.email);
    await this.audit.record(this.tenant.id, this.actor, 'member.password_reset', { type: 'user', id: userId, email: row.email });
    return true;
  }

  async updateUserRoles(userId: string, roleIds: string[], options: { expires?: Record<string, string | null>; effectiveAt?: string } = {}) {
    return this.rolesService.setUserRoles(userId, roleIds, options);
  }

  async getUser(userId: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const [user] = await this.withRoles(rows);
    return user ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).limit(1);
    const [user] = await this.withRoles(rows);
    return user ?? null;
  }
}
