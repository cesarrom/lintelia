import { Access, Require } from "../auth/access";
import { UsersService } from "../services/users.service";
import type { InviteUserInput } from "@repo/lintelia/schemas";
import { Scope, Inject, Controller, Get, Post, Put, Patch, Req, Res, type RawBodyRequest, Param } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import assert from 'assert';
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
import { json, jsonError, respondToChange } from "../http/respond";
import { BadRequestError } from "../http/errors";

@Controller({
  path: '/users',
  scope: Scope.REQUEST
})
export class UserHandler {
  constructor(
    @Inject(UsersService) private usersService: UsersService,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest
  ) { }

  @Require('members:read')
  @Get()
  async getUsers(@Res() ctx: Context): Promise<void> {
    try {
      const users = await this.usersService.listUsers();
      ctx.res = new Response(JSON.stringify(users), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    } catch (error: unknown) {
      jsonError(ctx, error, 'Failed to get users');
    }
    return;
  }

  @Require('members:read')
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
      jsonError(ctx, error, 'Failed to get user');
    }
    return;
  }

  @Require('members:invite')
  @Post()
  async inviteUser(@Res() ctx: Context): Promise<void> {
    await respondToChange(ctx, async () => {
      const data: InviteUserInput & { effectiveAt?: string } = await this.requestProxy.json();
      assert(data, 'data is required in the request body');
      assert(data.email, 'email is required');
      return this.usersService.inviteUser(data);
    }, () => ({ success: true }), 'Failed to invite user');
  }

  /** Replace the member's roles (`expires`: role → end date for time-bound roles; `effectiveAt`: from a date). */
  @Require('members:update')
  @Put('/:userId')
  async updateUserRoles(@Param('userId') userId: string, @Res() ctx: Context): Promise<void> {
    await respondToChange(ctx, async () => {
      const { roleIds, expires, effectiveAt }: { roleIds: string[]; expires?: Record<string, string | null>; effectiveAt?: string } = await this.requestProxy.json();
      if (!Array.isArray(roleIds)) throw new BadRequestError('roleIds array is required in the request body');
      return this.usersService.updateUserRoles(userId, roleIds, { expires, effectiveAt });
    }, () => ({ success: true }), 'Failed to update user roles');
  }

  @Require('members:deactivate')
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
      jsonError(ctx, error, 'Failed to deactivate user');
    }
    return;
  }

  @Require('members:deactivate')
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
      jsonError(ctx, error, 'Failed to activate user');
    }
    return;
  }

  @Require('members:deactivate')
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
      jsonError(ctx, error, 'Failed to reset user password');
    }
    return;
  }
}