import { Controller, Get, Res } from '@nestjs/common';
import type { Context } from 'hono';
import { PLATFORM_ROLES, TENANT_PERMISSION_CATALOG, PLATFORM_PERMISSION_CATALOG } from '@repo/fintivio/schemas';
import { Access, RequirePlatform } from '../auth/access';
import { json } from '../http/respond';

/** The authorization catalogue (docs/architecture/authorization.md). */
@Controller()
export class CatalogHandler {
  /** The permission catalogue is not sensitive: every member may read it (role and API client dialogs use it). */
  @Access('member')
  @Get('/permissions')
  permissions(@Res() ctx: Context) {
    json(ctx, TENANT_PERMISSION_CATALOG);
  }

  @RequirePlatform('platform.tenants:read')
  @Get('/platform/roles')
  platformRoles(@Res() ctx: Context) {
    json(ctx, PLATFORM_ROLES.map((role) => ({ id: role.key, name: role.name, description: role.description, permissions: role.permissions })));
  }

  @RequirePlatform('platform.tenants:read')
  @Get('/platform/permissions')
  platformPermissions(@Res() ctx: Context) {
    json(ctx, PLATFORM_PERMISSION_CATALOG);
  }
}
