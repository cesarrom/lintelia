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

  @Get()
  async getRoles(@Res() ctx: Context): Promise<void> {
    try {
      const roles = await this.rolesService.listRoles();
      ctx.res = new Response(JSON.stringify(roles), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: any) {
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get roles' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

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
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get roles by user ID' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

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
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to get role' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

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
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to create role' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Put('/:roleId')
  async updateRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    assert(roleId, 'roleId parameter is required');
    try {
      const { data }: Pick<UpdateRoleRequest, 'data'> = await this.requestProxy.json();
      assert(data, 'data is required in the request body');
      const role = await this.rolesService.updateRole(roleId, data);
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
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to update role' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

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
      ctx.res = new Response(JSON.stringify({ error: error.message || 'Failed to delete role' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}
