import { inject, injectable } from "tsyringe";
import { AppAuth } from "../clients/auth.client";
import { LogsService } from "./logs.service";
import { env } from "../constants";
import { AuthService } from "./auth.service";
import { Service } from "./service";
import { TenantsService } from "./tenants.service";
import { WebService } from "./web.service";

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
export class UsersService extends Service {
  private _auth: AppAuth;

  static dependencies() {
    return [
      AuthService,
      TenantsService,
      LogsService,
      WebService
    ]
  }

  constructor(
    @inject(AuthService) private _authService: AuthService,
    @inject(TenantsService) private _tenantService: TenantsService,
    @inject(LogsService) private logs: LogsService,
    @inject(WebService) private webService: WebService
  ) {
    super();
    this._auth = this._authService.auth;
  }

  async listUsers(): Promise<User[]> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.debug('Listing users', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          tenant: domain
        }
      });

      const response = await this._auth.management.user.searchAll([domain]);

      if (!response.data) return [];

      const users = response.data.map(user => ({
        id: user.userId,
        email: user.email || '',
        name: user.name || '',
        picture: user.picture,
        roles: user.userTenants?.find(t => t.tenantId === domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' as const : 'inactive' as const,
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      }));

      await this.logs.info('Users listed successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          tenant: domain,
          userCount: users.length
        }
      });

      return users;
    } catch (error) {
      await this.logs.error('Failed to list users', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return [];
    }
  }

  async inviteUser({ email, name, roleIds, loginId = email }: InviteUserInput): Promise<boolean> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.info('Inviting user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          email,
          name,
          roleIds,
          tenant: domain
        }
      });

      // Create invitation
      await this._auth.management.user.invite(loginId, {
        email,
        displayName: name,
        inviteUrl: `https://${domain}.${env.HOST}/sign-on`
      });

      await this._auth.management.user.addTenant(loginId, domain);
      await this._auth.management.user.addTenantRoles(loginId, domain, roleIds);

      await this.logs.info('User invited successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          email,
          name,
          roleIds,
          tenant: domain
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
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async deactivateUser(userId: string): Promise<boolean> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.warning('Deactivating user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      await this._auth.management.user.deactivate(userId);

      await this.logs.info('User deactivated successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to deactivate user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async activateUser(userId: string): Promise<boolean> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.info('Activating user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      await this._auth.management.user.activate(userId);

      await this.logs.info('User activated successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to activate user', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async resetPassword(userId: string): Promise<boolean> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.info('Resetting user password', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      await this._auth.management.user.expirePassword(userId);

      await this.logs.info('User password reset successfully', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      return true;
    } catch (error) {
      await this.logs.error('Failed to reset user password', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async updateUserRoles(userId: string, roleIds: string[]): Promise<boolean> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.info('Updating user roles', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          roleIds,
          tenant: domain
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
            tenant: domain
          }
        });
        return false;
      }

      const tenant = user.data.userTenants?.find(t => t.tenantId === domain);
      if (!tenant) {
        await this.logs.error('User not found in tenant', {
          category: 'security',
          source: 'UsersService',
          metadata: {
            userId,
            tenant: domain
          }
        });
        return false;
      }

      // Remove all current roles
      if (tenant?.roleNames?.length) {
        await this._auth.management.user.removeTenantRoles(userId, domain, tenant.roleNames || []);
      }

      // Add new roles
      if (roleIds.length > 0) {
        await this._auth.management.user.addTenantRoles(
          userId,
          domain,
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
          tenant: domain
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
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return false;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await this.logs.debug('Getting user details', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain
        }
      });

      const response = await this._auth.management.user.loadByUserId(userId);
      if (!response.data) {
        await this.logs.warning('User not found', {
          category: 'security',
          source: 'UsersService',
          metadata: {
            userId,
            tenant: domain
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
        roles: user.userTenants?.find(t => t.tenantId === domain)?.roleNames || [],
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
          tenant: domain
        }
      });

      return mappedUser;
    } catch (error) {
      await this.logs.error('Failed to get user details', {
        category: 'security',
        source: 'UsersService',
        metadata: {
          userId,
          tenant: domain,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      const response = await this._auth.management.user.search({
        emails: [email],
        tenantIds: [domain]
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
        roles: user.userTenants?.find(t => t.tenantId === domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' as const : 'inactive' as const,
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      }
    } catch (error) {
      return null;
    }
  }

  async loginByEmail(email: string) {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      const response = await this._auth.management.user.search({
        emails: [email],
        tenantIds: [domain]
      });

      if (!response.data) {
        return null;
      }

      const user = response.data[0];

      const [loginId] = user?.loginIds || [];

      if (!loginId) {
        throw new Error('Login ID not found');
      }

      const jwtResponse = await this._auth.management.jwt.signIn(loginId);

      const session = jwtResponse.data;

      if (!session) {
        throw new Error('Session not found');
      }

      return session;
    } catch (error) {
      return null;
    }
  }

  async getUserByToken(token: string) {
    const response = await this._auth.validateJwt(token);
    const userId = response.token.sub;

    if (!userId) {
      throw new Error('User ID not found');
    }

    const user = await this.getUser(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async getSessionUser() {
    const userId = await this.webService.getUserId();

    if (!userId) {
      return null;
    }

    const user = await this._auth.management.user.loadByUserId(userId);

    return user?.data || null;
  }
}