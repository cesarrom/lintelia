import { inject, injectable } from "tsyringe";
import { AUTH_TOKEN, TENANT_TOKEN } from "../injector/tokens";
import { auth } from "../clients/auth.client";
import { Tenant } from "../entities/global";
import { SdkResponse } from "@descope/node-sdk";
import { RolesService } from "./roles.service";
import { LogsService } from "./logs.service";
import { env } from "../constants";

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  roles: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteUserInput {
  email: string;
  name: string;
  roleIds: string[];
  loginId?: string;
}

@injectable()
export class UsersService {
  constructor(
    @inject(AUTH_TOKEN) private _auth: typeof auth,
    @inject(TENANT_TOKEN) private _tenant: Tenant,
    @inject(RolesService) private _roles: RolesService,
    @inject(LogsService) private logs: LogsService
  ) { }

  async listUsers(): Promise<User[]> {
    try {
      await this.logs.debug('Listing users', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          tenant: this._tenant.domain
        }
      });

      const response = await this._auth.management.user.searchAll([this._tenant.domain]);

      if (!response.data) return [];

      const users = response.data.map(user => ({
        id: user.userId,
        email: user.email || '',
        name: user.name || '',
        picture: user.picture,
        roles: user.userTenants?.find(t => t.tenantId === this._tenant.domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' as const : 'inactive' as const,
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      }));

      await this.logs.info('Users listed successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          tenant: this._tenant.domain,
          userCount: users.length
        }
      });

      return users;
    } catch (error) {
      await this.logs.error('Failed to list users', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return [];
    }
  }

  async inviteUser({ email, name, roleIds, loginId = email }: InviteUserInput): Promise<boolean> {
    try {
      await this.logs.info('Inviting user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          email,
          name,
          roleIds,
          tenant: this._tenant.domain
        }
      });

      // Create invitation
      await this._auth.management.user.invite(loginId, {
        email,
        displayName: name,
        inviteUrl: `https://${this._tenant.domain}.${env.HOST}/sign-on`
      });

      await this._auth.management.user.addTenant(loginId, this._tenant.domain);
      await this._auth.management.user.addTenantRoles(loginId, this._tenant.domain, roleIds);

      await this.logs.info('User invited successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          email,
          name,
          roleIds,
          tenant: this._tenant.domain
        }
      });

    return true;
    } catch (error) {
      await this.logs.error('Failed to invite user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          email,
          name,
          roleIds,
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async deactivateUser(userId: string): Promise<boolean> {
    try {
      await this.logs.warning('Deactivating user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      await this._auth.management.user.deactivate(userId);

      await this.logs.info('User deactivated successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to deactivate user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async activateUser(userId: string): Promise<boolean> {
    try {
      await this.logs.info('Activating user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      await this._auth.management.user.activate(userId);

      await this.logs.info('User activated successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to activate user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async resetPassword(userId: string): Promise<boolean> {
    try {
      await this.logs.info('Resetting user password', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      await this._auth.management.user.expirePassword(userId);

      await this.logs.info('User password reset successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to reset user password', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async updateUserRoles(userId: string, roleIds: string[]): Promise<boolean> {
    try {
      await this.logs.info('Updating user roles', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          roleIds,
          tenant: this._tenant.domain
        }
      });

      // First, get current roles
      const user = await this._auth.management.user.loadByUserId(userId);
      if (!user.data) {
        await this.logs.error('User not found for role update', {
          category: 'security',
          source: 'UsersService',
          metadata: {
            userId,
            tenant: this._tenant.domain
          }
        });
        return false;
      }

      const tenant = user.data.userTenants?.find(t => t.tenantId === this._tenant.domain);
      if (!tenant) {
        await this.logs.error('User not found in tenant', {
          category: 'security',
          source: 'UsersService',
          metadata: {
            userId,
            tenant: this._tenant.domain
          }
        });
        return false;
      }

      // Remove all current roles
      if (tenant?.roleNames?.length) {
        await this._auth.management.user.removeTenantRoles(userId, this._tenant.domain, tenant.roleNames || []);
      }

      // Add new roles
      if (roleIds.length > 0) {
        await this._auth.management.user.addTenantRoles(
          userId,
          this._tenant.domain,
          roleIds
        );
      }

      await this.logs.info('User roles updated successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          oldRoles: tenant.roleNames,
          newRoles: roleIds,
          tenant: this._tenant.domain
        }
      });

    return true;
    } catch (error) {
      await this.logs.error('Failed to update user roles', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          roleIds,
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      await this.logs.debug('Getting user details', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain
        }
      });

      const response = await this._auth.management.user.loadByUserId(userId);
      if (!response.data) {
        await this.logs.warning('User not found', {
          category: 'security',
          source: 'UsersService',
          metadata: {
            userId,
            tenant: this._tenant.domain
          }
        });
        return null;
      }

      const user = response.data;
      const mappedUser = {
        id: user.userId,
        email: user.email || '',
        name: user.name || '',
        picture: user.picture,
        roles: user.userTenants?.find(t => t.tenantId === this._tenant.domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' as const : 'inactive' as const,
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      };

      await this.logs.debug('User details retrieved successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          email: mappedUser.email,
          roles: mappedUser.roles,
          tenant: this._tenant.domain
        }
      });

      return mappedUser;
    } catch (error) {
      await this.logs.error('Failed to get user details', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: this._tenant.domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const response = await this._auth.management.user.search({
        emails: [email],
        tenantIds: [this._tenant.domain]
      });

      if (!response.data) {
        return null;
      }

      const user = response.data[0];

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.userId,
        email: user.email || '',
        name: user.name || '',
        picture: user.picture,
        roles: user.userTenants?.find(t => t.tenantId === this._tenant.domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' as const : 'inactive' as const,
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      }
    } catch (error) {
      return null;
    }
  }
}