import { inject, injectable } from "tsyringe";
import { AUTH_TOKEN, TENANT_TOKEN } from "../injector/tokens";
import { auth } from "../clients/auth.client";
import { Tenant } from "../entities/global";

@injectable()
export class UserService {
  static roles = {
    admin: 'admin',
    reviewer: 'reviewer',
    user: 'user',
  };

  constructor(
    @inject(AUTH_TOKEN) private _auth: typeof auth,
    @inject(TENANT_TOKEN) private _tenant: Tenant
  ) { }

  async createUserRole({ userId, roleId, tenantId = this._tenant.domain }: UserRoleInput) {
    // Add role in auth provider
    await this._auth.management.user.addTenantRoles(userId, tenantId, [roleId]);

    return true;
  }

  private async getUserAndTenant({ userId, tenantId = this._tenant.domain }: UserInput) {
    const { data: user } = await this._auth.management.user.loadByUserId(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const tenants = user.userTenants?.filter(tenant => tenant.tenantId === tenantId) || [];

    if (!tenants.length) {
      return { user }
    }

    const [tenant] = tenants;

    return { user, tenant };
  }

  async getRolesByUserId(params: UserInput): Promise<string[]> {
    const { tenant } = await this.getUserAndTenant(params);

    return tenant?.roleNames || [];
  }

  async deleteUserRole({ roleId, userId, tenantId = this._tenant.domain }: UserRoleInput) {
    await this._auth.management.user.removeTenantRoles(userId, tenantId, [roleId]);

    return true;
  }
}

interface UserRoleInput {
  userId: string;
  roleId: string;
  tenantId?: string
}

interface UserInput {
  userId: string;
  tenantId?: string
}