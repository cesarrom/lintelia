import { respondToChange, handle } from "../http/respond";
import { Require } from "../auth/access";
import { RolesService } from "../services/roles.service";
import { Scope, Inject, Controller, Get, Post, Put, Delete, Res, Param } from "@nestjs/common";
import type { Context } from "hono";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
import { NotFoundError } from "../http/errors";
import { AccessQueriesService } from "../access/queries.service";

type RoleBody = { name?: string; description?: string; permissions?: string[]; customPermissions?: string[]; effectiveAt?: string };

/**
 * Roles (FIA-05, docs/plans/15): system roles (the platform's, extendable with the institution's custom permissions)
 * and custom roles. Changes that grant or revoke access are access changes: `202` with the change when they wait for
 * a second administrator or their effective date.
 */
@Controller({
  path: '/roles',
  scope: Scope.REQUEST
})
export class RoleHandler {
  constructor(@Inject(RolesService) private rolesService: RolesService,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest,
    @Inject(AccessQueriesService) private readonly queries: AccessQueriesService,
  ) { }

  private async role(key: string) {
    const role = await this.rolesService.getRole(key);
    if (!role) throw new NotFoundError('Role not found');
    return role;
  }

  @Require('roles:read')
  @Get()
  async getRoles(@Res() ctx: Context): Promise<void> {
    await handle(ctx, () => this.rolesService.listRoles(), 'Failed to get roles');
  }

  @Require('members:read')
  @Get('/by-users/:userId')
  async getRolesByUserId(@Res() ctx: Context, @Param('userId') userId: string): Promise<void> {
    await handle(ctx, () => this.rolesService.getRolesByUserId({ userId }), 'Failed to get roles by user ID');
  }

  @Require('roles:read')
  @Get('/:roleId')
  async getRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    await handle(ctx, () => this.role(roleId), 'Failed to get role');
  }

  /** Members holding the role, with where each assignment came from (manual, IdP groups, expiry). */
  @Require('roles:read', 'members:read')
  @Get('/:roleId/members')
  async members(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    await handle(ctx, () => this.queries.roleMembers(roleId), 'Failed to list the members of the role');
  }

  /** What the role opens: task queues, escalations, workflows its holders may start, IdP groups that give it. */
  @Require('roles:read')
  @Get('/:roleId/usage')
  async usage(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    await handle(ctx, () => this.queries.roleUsage(roleId), 'Failed to describe the role');
  }

  @Require('roles:manage')
  @Post()
  async createRole(@Res() ctx: Context): Promise<void> {
    await respondToChange(ctx, async () => this.rolesService.createRole(await this.requestProxy.json<RoleBody & { name: string; permissions: string[] }>()),
      (row) => this.role(row.key), 'Failed to create role', 201);
  }

  @Require('roles:manage')
  @Put('/:roleId')
  async updateRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    await respondToChange(ctx, async () => {
      // `{ data: { ... } }` (historical shape) or the fields directly.
      const body = await this.requestProxy.json<RoleBody & { data?: RoleBody }>();
      return this.rolesService.updateRole(roleId, body.data ?? body);
    }, () => this.role(roleId), 'Failed to update role');
  }

  @Require('roles:manage')
  @Delete('/:roleId')
  async deleteRole(@Res() ctx: Context, @Param('roleId') roleId: string): Promise<void> {
    const effectiveAt = new URL(this.requestProxy.url).searchParams.get('effectiveAt') ?? undefined;
    await respondToChange(ctx, () => this.rolesService.deleteRole(roleId, effectiveAt), () => undefined, 'Failed to delete role', 204);
  }
}
