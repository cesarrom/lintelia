import { Controller, Delete, Get, Inject, Param, Post, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require } from '../auth/access';
import { InstallationsService } from '../integrations/installations.service';
import { handle } from '../http/respond';

/** The institution's connections to its systems and vendors (docs/plans/03). */
@Controller({ path: '/integrations', scope: Scope.REQUEST })
export class IntegrationsHandler {
  constructor(@Inject(InstallationsService) private readonly installations: InstallationsService) { }

  @Require('integrations:read')
  @Get('/catalog')
  catalog(@Res() ctx: Context) {
    return handle(ctx, () => this.installations.catalog(), 'Failed to list connectors');
  }

  /** Connections (never their secrets: those stay in the connector). Flow designers see them to pick one in steps. */
  @Require('integrations:read')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.installations.list(), 'Failed to list connections');
  }

  /** Start connecting: `{ installationId, url }` of the connector's connect page (single-use code in the URL). */
  @Require('integrations:manage')
  @Post('/:connectorId/install')
  install(@Param('connectorId') connectorId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.installations.install(connectorId), 'Failed to start the connection', 201);
  }

  /** The connector's settings page for an existing connection (embedded or redirect). */
  @Require('integrations:manage')
  @Post('/:installationId/setup-session')
  setup(@Param('installationId') installationId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.installations.setupSession(installationId), 'Failed to open the settings');
  }

  @Require('integrations:manage')
  @Delete('/:installationId')
  remove(@Param('installationId') installationId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.installations.uninstall(installationId), 'Failed to remove the connection');
  }

  /** Dynamic options of a component field (asked from the connector). */
  @Require('workflows:manage')
  @Post('/:installationId/options/:name')
  options(@Param('installationId') installationId: string, @Param('name') name: string, @Res() ctx: Context) {
    return handle(ctx, () => this.installations.options(installationId, name), 'Failed to load options');
  }
}
