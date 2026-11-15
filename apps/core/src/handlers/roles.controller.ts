import { json, jsonError } from "../http/respond";
import { Access, Require } from "../auth/access";
import { RolesService } from "../services/roles.service";
import { Scope, Inject, Controller, Get, Post, Put, Delete, Res, Param } from "@nestjs/common";
import type { Context } from "hono";
import type { CreateRoleRequest, UpdateRoleRequest } from "@repo/fintivio/schemas";
import assert from 'assert';
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/roles',
  scope: Scope.REQUEST
})
export class RoleHandler {
  constructor(@Inject(RolesService) private rolesService: RolesService,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest,
  ) { }

  @Require('roles:read')
  @Get()
  async getRoles(@Res() ctx: Context): Promise<void> {
    try {
      const roles = await this.rolesService.listRoles();
      ctx.res = new Response(JSON.stringify(roles), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      jsonError(ctx, error, 'Failed to get roles');
    }
    return;
  }

  @Require('members:read')
  @Get('/by-users/:userId')
  async getRolesByUserId(@Res() ctx: Context, @Param('userId') userId: string): Promise<void> {
    assert(userId, 'userId parameter is required');
    try {
      const roles = await this.rolesService.getRolesByUserId({ userId });
      ctx.res = new Response(JSON.stringify(roles), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      jsonError(ctx, error, 'Failed to get roles by user ID');
    }
    return;
  }

  @Require('roles:read')
  @Get('/:roleId')
  async getRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    assert(roleId, 'roleId parameter is required');
    try {
      const role = await this.rolesService.getRole(roleId);
      if (!role) {
        ctx.res = new Response(JSON.stringify({ error: 'Role not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify(role), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      jsonError(ctx, error, 'Failed to get role');
    }
    return;
  }

  @Require('roles:manage')
  @Post()
  async createRole(@Res() ctx: Context): Promise<void> {
    try {
      const data: CreateRoleRequest = await this.requestProxy.json();
      assert(data, 'data is required in the request body');
      const role = await this.rolesService.createRole(data);
      ctx.res = new Response(JSON.stringify(role), {
        headers: { 'Content-Type': 'application/json' },
        status: 201
      });
    } catch (error: any) {
      jsonError(ctx, error, 'Failed to create role');
    }
    return;
  }

  @Require('roles:manage')
  @Put('/:roleId')
  async updateRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    assert(roleId, 'roleId parameter is required');
    try {
      // `{ data: { ... } }` (historical shape) or the fields directly.
      const body = await this.requestProxy.json<Partial<Pick<UpdateRoleRequest, 'data'>> & UpdateRoleRequest['data']>();
      const role = await this.rolesService.updateRole(roleId, body.data ?? body);
      if (!role) {
        ctx.res = new Response(JSON.stringify({ error: 'Role not found for update' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify(role), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: any) {
      jsonError(ctx, error, 'Failed to update role');
    }
    return;
  }

  @Require('roles:manage')
  @Delete('/:roleId')
  async deleteRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    assert(roleId, 'roleId parameter is required');
    try {
      const success = await this.rolesService.deleteRole(roleId);
      if (!success) {
        ctx.res = new Response(JSON.stringify({ error: 'Role not found or could not be deleted' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(null, { status: 204 });
      }
    } catch (error: any) {
      jsonError(ctx, error, 'Failed to delete role');
    }
    return;
  }
}
