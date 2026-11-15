import { UsersService } from "../services/users.service";
import type { InviteUserInput } from "@repo/fintivio/schemas";
import { Scope, Inject, Controller, Get, Post, Put, Patch, Req, Res, type RawBodyRequest, Param } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import assert from 'assert';
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";

@Controller({
  path: '/users',
  scope: Scope.REQUEST
})
export class UserHandler {
  constructor(
    @Inject(UsersService) private usersService: UsersService,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest
  ) { }

  @Get()
  async getUsers(@Res() ctx: Context): Promise<void> {
    try {
      const users = await this.usersService.listUsers();
      ctx.res = new Response(JSON.stringify(users), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get users';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Get('/:userId')
  async getUser(@Param('userId') userId: string, @Res() ctx: Context): Promise<void> {
    assert(userId, 'userId parameter is required');
    try {
      const user = await this.usersService.getUser(userId);
      if (!user) {
        ctx.res = new Response(JSON.stringify({ error: 'User not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404
        });
      } else {
        ctx.res = new Response(JSON.stringify(user), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get user';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Post()
  async inviteUser(@Res() ctx: Context): Promise<void> {
    try {
      const data: InviteUserInput = await this.requestProxy.json();
      assert(data, 'data is required in the request body');
      assert(data.email, 'email is required');

      const success = await this.usersService.inviteUser(data);
      ctx.res = new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to invite user';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Put('/:userId')
  async updateUserRoles(@Param('userId') userId: string, @Res() ctx: Context): Promise<void> {
    assert(userId, 'userId parameter is required');
    try {
      const { roleIds }: { roleIds: string[] } = await this.requestProxy.json();
      assert(roleIds && Array.isArray(roleIds), 'roleIds array is required in the request body');

      const success = await this.usersService.updateUserRoles(userId, roleIds);
      ctx.res = new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update user roles';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Patch('/:userId/deactivate')
  async deactivateUser(@Param('userId') userId: string, @Res() ctx: Context): Promise<void> {
    assert(userId, 'userId parameter is required');
    try {
      const success = await this.usersService.deactivateUser(userId);
      ctx.res = new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deactivate user';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Patch('/:userId/activate')
  async activateUser(@Param('userId') userId: string, @Res() ctx: Context): Promise<void> {
    assert(userId, 'userId parameter is required');
    try {
      const success = await this.usersService.activateUser(userId);
      ctx.res = new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to activate user';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }

  @Patch('/:userId/reset-password')
  async resetUserPassword(@Param('userId') userId: string, @Res() ctx: Context): Promise<void> {
    assert(userId, 'userId parameter is required');
    try {
      const success = await this.usersService.resetPassword(userId);
      ctx.res = new Response(JSON.stringify({ success }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reset user password';
      ctx.res = new Response(JSON.stringify({ error: message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }
    return;
  }
}