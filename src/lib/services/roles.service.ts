import { inject, injectable } from "tsyringe";
import { AUTH_TOKEN, TENANT_TOKEN } from "../injector/tokens";
import { auth } from "../clients/auth.client";
import { Tenant } from "../entities/global";
import { Role } from "@/lib/auth/roles";
import { Permission, PERMISSIONS } from "@/lib/auth/permissions";
import { SdkResponse } from "@descope/node-sdk";
import { LogsService } from "./logs.service";

interface AuthRole {
  name: string;
  description?: string;
  permissionNames?: string[];
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

@injectable()
export class RolesService {
  constructor(
    @inject(AUTH_TOKEN) private _auth: typeof auth,
    @inject(TENANT_TOKEN) private _tenant: Tenant,
    @inject(LogsService) private logs: LogsService
  ) { }

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
        this._tenant.domain
      );

      await this.logs.info('Role created', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          roleName: name,
          permissions,
          tenant: this._tenant.domain
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
          tenant: this._tenant.domain,
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
          this._tenant.domain
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
            tenant: this._tenant.domain
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
          tenant: this._tenant.domain
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
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Delete role from auth provider
      await this._auth.management.role.delete(roleId, this._tenant.domain);

      await this.logs.info('Role deleted', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          tenant: this._tenant.domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to delete role', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          tenant: this._tenant.domain,
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
        tenantIds: [this._tenant.domain]
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
  async createUserRole({ userId, roleId, tenantId = this._tenant.domain }: UserRoleInput) {
    try {
      // Add role in auth provider
      await this._auth.management.user.addTenantRoles(userId, tenantId, [roleId]);

      await this.logs.info('User role assigned', {
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

  async deleteUserRole({ roleId, userId, tenantId = this._tenant.domain }: UserRoleInput) {
    try {
      await this._auth.management.user.removeTenantRoles(userId, tenantId, [roleId]);

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