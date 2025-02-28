import { inject, injectable } from "tsyringe";
import { AUTH_TOKEN, TENANT_TOKEN } from "../injector/tokens";
import { auth } from "../clients/auth.client";
import { Tenant } from "../entities/global";
import { SdkResponse } from "@descope/node-sdk";
import { RolesService } from "./roles.service";
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
    @inject(RolesService) private _roles: RolesService
  ) { }

  async listUsers(): Promise<User[]> {
    try {
      const response = await this._auth.management.user.searchAll([this._tenant.domain]);

      if (!response.data) return [];

      return response.data.map(user => ({
        id: user.userId,
        email: user.email || '',
        name: user.name || '',
        picture: user.picture,
        roles: user.userTenants?.find(t => t.tenantId === this._tenant.domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' : 'inactive',
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      }));
    } catch (error) {
      console.error('Failed to list users:', error);
      return [];
    }
  }

  async inviteUser({ email, name, roleIds, loginId = email }: InviteUserInput): Promise<boolean> {
    try {
      // Create invitation
      await this._auth.management.user.invite(loginId, {
        email,
        displayName: name,
        inviteUrl: `https://${this._tenant.domain}.${env.HOST}/sign-on`
      });

      await this._auth.management.user.addTenant(loginId, this._tenant.domain);
      await this._auth.management.user.addTenantRoles(loginId, this._tenant.domain, roleIds);

      return true;
    } catch (error) {
      console.error('Failed to invite user:', error);
      return false;
    }
  }

  async deactivateUser(userId: string): Promise<boolean> {
    try {
      await this._auth.management.user.deactivate(userId);
      return true;
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      return false;
    }
  }

  async activateUser(userId: string): Promise<boolean> {
    try {
      await this._auth.management.user.activate(userId);
      return true;
    } catch (error) {
      console.error('Failed to activate user:', error);
      return false;
    }
  }

  async resetPassword(userId: string): Promise<boolean> {
    try {
      await this._auth.management.user.expirePassword(userId);
      return true;
    } catch (error) {
      console.error('Failed to reset password:', error);
      return false;
    }
  }

  async updateUserRoles(userId: string, roleIds: string[]): Promise<boolean> {
    try {
      // First, get current roles
      const user = await this._auth.management.user.loadByUserId(userId);
      if (!user.data) return false;

      const tenant = user.data.userTenants?.find(t => t.tenantId === this._tenant.domain);
      if (!tenant) return false;

      

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

      return true;
    } catch (error) {
      console.error('Failed to update user roles:', error);
      return false;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      const response = await this._auth.management.user.loadByUserId(userId);
      if (!response.data) return null;

      const user = response.data;
      return {
        id: user.userId,
        email: user.email || '',
        name: user.name || '',
        picture: user.picture,
        roles: user.userTenants?.find(t => t.tenantId === this._tenant.domain)?.roleNames || [],
        status: user.status === 'enabled' ? 'active' : 'inactive',
        createdAt: new Date(user.createTime),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }
} 