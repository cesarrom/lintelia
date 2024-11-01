import { eq } from "drizzle-orm";
import { userRoles } from "../models/platform.sql";
import { TenantsService, type PlatformDB } from "./tenants.service";
import { Autowire, Injectable } from "ts-injection";
import { AUTH_TOKEN, PLATFORM_DB_TOKEN, TENANT_TOKEN } from "../libs/injector/tokens";
import { auth } from "../clients/auth.client";

@Injectable()
export class UserRolesService {
  static roles = {
    admin: 'admin',
    reviewer: 'reviewer',
    user: 'user',
  };

  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB;

  @Autowire(AUTH_TOKEN)
  private _auth: typeof auth;

  @Autowire(TENANT_TOKEN)
  private _tenant: Awaited<ReturnType<TenantsService['getByDomain']>>;

  async createUserRole(userRoleData: typeof userRoles.$inferInsert) {
    const user = await this._auth.management.user.loadByUserId(userRoleData.userId);
    const [loginId] = user.data.loginIds;

    await this._auth.management.user.addTenantRoles(loginId, this._tenant.domain, [userRoleData.role]);

    const [userRole] = await this.db.insert(userRoles).values({
      ...userRoleData,
    }).returning();

    return userRole;
  }

  async getUserRoleById(id: number) {
    return await this.db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, id))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async updateUserRole(id: number, userRoleData: Partial<typeof userRoles.$inferInsert>) {
    return await this.db
      .update(userRoles)
      .set(userRoleData)
      .where(eq(userRoles.id, id))
      .returning();
  }

  async getRoleByUserId(userId: string) {
    return await this.db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1)
      .then((res) => res[0] || null);
  }

  async deleteUserRole(id: number) {
    return await this.db.delete(userRoles).where(eq(userRoles.id, id)).returning();
  }

  async getAllUserRoles() {
    return await this.db.select().from(userRoles);
  }
}