import { type AppAuth } from "../clients/auth.client";
import { AUTH } from "../injector/tokens/auth.token";
import { TENANT } from "../injector/tokens/tenant.token";
import { LogsService } from "./logs.service";
import { AbstractService } from "./service";
import { AuthRole, Permission, PERMISSIONS, Role, UserInput, UserRoleInput, type Tenant } from "@repo/fintivio/schemas";
import { Injectable, Inject, Scope } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class RolesService extends AbstractService {
  constructor(
    @Inject(AUTH) private _auth: AppAuth,
    @Inject(LogsService) private logs: LogsService,
    @Inject(TENANT) private tenantValueService: Tenant
  ) {
    super();
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
        this.tenantValueService.domain
      );

      await this.logs.info('Role created', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          roleName: name,
          permissions,
          tenant: this.tenantValueService.domain
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
          tenant: this.tenantValueService.domain,
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
          this.tenantValueService.domain
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
            tenant: this.tenantValueService.domain
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
          tenant: this.tenantValueService.domain
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
          tenant: this.tenantValueService.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  async deleteRole(roleId: string): Promise<boolean> {
    try {
      // Delete role from auth provider
      await this._auth.management.role.delete(roleId, this.tenantValueService.domain);

      await this.logs.info('Role deleted', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          tenant: this.tenantValueService.domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to delete role', {
        category: 'security',
        source: 'RolesService',
        metadata: {
          roleId,
          tenant: this.tenantValueService.domain,
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
        tenantIds: [this.tenantValueService.domain]
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
    const actualTenantId = tenantId || this.tenantValueService.domain;
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
    const actualTenantId = tenantId || this.tenantValueService.domain;
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
    const actualTenantId = tenantId || this.tenantValueService.domain;
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
