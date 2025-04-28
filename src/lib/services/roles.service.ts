import { inject, injectable } from "tsyringe";
import { AppAuth } from "../clients/auth.client";
import { Role } from "@/lib/auth/roles";
import { Permission, PERMISSIONS } from "@/lib/auth/permissions";
import { LogsService } from "./logs.service";
import { AuthService } from "./auth.service";
import { Service } from "./service";
import { TenantsService } from "./tenants.service";

interface AuthRole {
  name: string;
  description?: string;
  permissionNames?: string[];
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

@injectable()
export class RolesService extends Service {
  private _auth: AppAuth;

  static dependencies() {
    return [
      AuthService,
      TenantsService,
      LogsService
    ]
  }

  constructor(
    @inject(AuthService) private _authService: AuthService,
    @inject(TenantsService) private _tenantService: TenantsService,
    @inject(LogsService) private logs: LogsService
  ) {
    super();
    this._auth = this._authService.auth;
  }

  // Role Management Methods
  async createRole(data: { name: string; description: string; permissions: string[] }): Promise<Role> {
    const { name, description, permissions } = data;
    const roleId = name.toLowerCase().replace(/\s+/g, '_');

    try {
      // Create role in auth provider
      await this._auth.management.role.create(
        roleId,
        description,
        permissions,
        await this._tenantService.getCachedDomainFromTenant()
      );

      await this.logs.info('Role created', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          roleName: name,
          permissions,
          tenant: await this._tenantService.getCachedDomainFromTenant()
        }
      });

      return {
        id: roleId,
        name,
        description,
        permissions,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      await this.logs.error('Failed to create role', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          roleName: name,
          permissions,
          tenant: await this._tenantService.getCachedDomainFromTenant(),
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async updateRole(roleId: string, data: { name?: string; description?: string; permissions?: string[] }): Promise<Role | null> {
    const { name, description, permissions } = data;

    try {
      // Update role in auth provider
      if (permissions) {
        await this._auth.management.role.update(
          roleId,
          name || roleId,
          description,
          permissions,
          await this._tenantService.getCachedDomainFromTenant()
        );
      }

      // Get updated role
      const role = await this.getRole(roleId);
      if (!role) {
        await this.logs.warning('Role update attempted on non-existent role', {
          category: 'security',
          source: 'RolesService',
          metadata: {
            roleId,
            tenant: await this._tenantService.getCachedDomainFromTenant()
          }
        });
        return null;
      }

      await this.logs.info('Role updated', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          roleName: name,
          updatedFields: Object.keys(data),
          tenant: await this._tenantService.getCachedDomainFromTenant()
        }
      });

      return {
        ...role,
        ...data,
        updatedAt: new Date(),
      };
    } catch (error) {
      await this.logs.error('Failed to update role', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          roleName: name,
          tenant: await this._tenantService.getCachedDomainFromTenant(),
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Delete role from auth provider
      await this._auth.management.role.delete(roleId, await this._tenantService.getCachedDomainFromTenant());

      await this.logs.info('Role deleted', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          tenant: await this._tenantService.getCachedDomainFromTenant()
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to delete role', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          tenant: await this._tenantService.getCachedDomainFromTenant(),
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async getRole(roleId: string): Promise<Role | null> {
    try {
      // Since there's no direct 'load' method, we'll search for the role
      const roles = await this.listRoles();
      return roles.find(role => role.id === roleId) || null;
    } catch (error) {
      console.error('Failed to get role:', error);
      return null;
    }
  }

  async listRoles(): Promise<Role[]> {
    try {
      const response = await this._auth.management.role.search({
        tenantIds: [await this._tenantService.getCachedDomainFromTenant()]
      });

      if (!response.data) return [];

      return (response.data as AuthRole[]).map(role => ({
        id: role.name,
        name: role.name,
        description: role.description || '',
        permissions: role.permissionNames || [],
        createdAt: new Date(role.createdAt || Date.now()),
        updatedAt: new Date(role.updatedAt || Date.now()),
      }));
    } catch (error) {
      console.error('Failed to list roles:', error);
      return [];
    }
  }

  async listPermissions(): Promise<Permission[]> {
    return PERMISSIONS;
  }

  // User Role Methods
  async createUserRole({ userId, roleId, tenantId }: UserRoleInput) {
    const actualTenantId = tenantId || (await this._tenantService.getCachedDomainFromTenant());
    try {
      // Add role in auth provider
      await this._auth.management.user.addTenantRoles(userId, actualTenantId, [roleId]);

      await this.logs.info('User role assigned', {
        category: 'security',
        source: 'RolesService',
        userId,
        metadata: {
          roleId,
          tenant: actualTenantId
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to assign user role', {
        category: 'security',
        source: 'RolesService',
        userId,
        metadata: {
          roleId,
          tenant: tenantId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async deleteUserRole({ roleId, userId, tenantId }: UserRoleInput) {
    const actualTenantId = tenantId || (await this._tenantService.getCachedDomainFromTenant());
    try {
      await this._auth.management.user.removeTenantRoles(userId, actualTenantId, [roleId]);

      await this.logs.info('User role removed', {
        category: 'security',
        source: 'RolesService',
        userId,
        metadata: {
          roleId,
          tenant: tenantId
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to remove user role', {
        category: 'security',
        source: 'RolesService',
        userId,
        metadata: {
          roleId,
          tenant: tenantId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  private async getUserAndTenant({ userId, tenantId }: UserInput) {
    const actualTenantId = tenantId || (await this._tenantService.getCachedDomainFromTenant());
    const { data: user } = await this._auth.management.user.loadByUserId(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const tenants = user.userTenants?.filter(tenant => tenant.tenantId === actualTenantId) || [];

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