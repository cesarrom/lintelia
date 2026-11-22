import { Controller, Get, Res } from '@nestjs/common';
import type { Context } from 'hono';
import { PLATFORM_ROLES, PLATFORM_PERMISSION_CATALOG } from '@repo/lintelia/schemas';
import { RequirePlatform } from '../auth/access';
import { json } from '../http/respond';

/** The platform's authorization catalogue (the institutions' own catalogue is `GET /permissions`, AccessHandler). */
@Controller()
export class CatalogHandler {
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
