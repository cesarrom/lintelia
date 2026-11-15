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
    const assignments = await this.db.select({ userId: userRoles.userId, key: roles.key }).from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, userRoles.tenantId)));
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      picture: row.picture ?? undefined,
      roles: assignments.filter((a) => a.userId === row.id).map((a) => a.key),
      kind: row.kind,
      status: row.status === 'active' ? 'active' as const : 'inactive' as const,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.email));
    return this.withRoles(rows);
  }

  private get actor() {
    return { type: this.principal?.kind ?? 'system', id: this.principal?.userId, email: this.principal?.email };
  }

  async inviteUser({ email, name, roleIds = [] }: InviteUserInput): Promise<boolean> {
    // Escalation rule: you can only invite someone into roles whose permissions you hold.
    await this.rolesService.assertCanAssign(roleIds);
    await this.invitations.createInvitation(email, roleIds[0] ?? '', this.tenant.domain, name, roleIds);
    return true;
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
    return this.setStatus(userId, 'disabled', 'member.deactivated');
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

  async updateUserRoles(userId: string, roleIds: string[]): Promise<boolean> {
    await this.rolesService.setUserRoles(userId, roleIds);
    return true;
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
