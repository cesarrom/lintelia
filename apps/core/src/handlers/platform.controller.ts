import { Controller, Get, Inject, Param, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import { Require, RequirePlatform } from '../auth/access';
import { PlatformStaffService } from '../services/platform-staff.service';
import { SupportAccessService } from '../services/support-access.service';
import { PlatformAuditWriter } from '../services/platform-audit.writer';
import { ConnectorRegistry } from '../integrations/registry';
import { USER } from '../injector/tokens/user.token';
import type { User } from '@repo/fintivio/schemas';
import { BadRequestError } from '../http/errors';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle } from '../http/respond';
import { AccessRecovery } from '../access/recovery';

/** Platform console: staff accounts, the platform audit log and support-access requests. */
@Controller({ path: '/platform', scope: Scope.REQUEST })
export class PlatformHandler {
  constructor(
    @Inject(PlatformStaffService) private readonly staff: PlatformStaffService,
    @Inject(SupportAccessService) private readonly support: SupportAccessService,
    @Inject(PlatformAuditWriter) private readonly audit: PlatformAuditWriter,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
    @Inject(ConnectorRegistry) private readonly registry: ConnectorRegistry,
    @Inject(USER) private readonly user: User,
    @Inject(AccessRecovery) private readonly recovery: AccessRecovery,
  ) { }

  private get actor() {
    return { type: 'staff', id: this.user.userId, email: this.user.email };
  }

  @RequirePlatform('platform.connectors:manage')
  @Get('/connectors')
  connectors(@Res() ctx: Context) {
    return handle(ctx, () => this.registry.list(), 'Failed to list connectors');
  }

  /** Register a connector version from its manifest URL (draft until approved). */
  @RequirePlatform('platform.connectors:manage')
  @Post('/connectors')
  registerConnector(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const { manifestUrl } = await this.request.json<{ manifestUrl?: string }>();
      if (!manifestUrl) throw new BadRequestError('manifestUrl is required');
      const result = await this.registry.register(manifestUrl);
      await this.audit.record(this.actor, 'connector.registered', { type: 'connector', id: result.manifest.id }, null, { version: result.manifest.version, manifestUrl });
      return { id: result.manifest.id, version: result.manifest.version, status: result.status };
    }, 'Failed to register the connector', 201);
  }

  @RequirePlatform('platform.connectors:manage')
  @Post('/connectors/:connectorId/versions/:version/approve')
  approveConnector(@Param('connectorId') connectorId: string, @Param('version') version: string, @Res() ctx: Context) {
    return handle(ctx, async () => {
      const row = await this.registry.approve(connectorId, version, this.user.email);
      await this.audit.record(this.actor, 'connector.approved', { type: 'connector', id: connectorId }, null, { version });
      return { id: connectorId, version: row.version, status: row.status };
    }, 'Failed to approve');
  }

  @RequirePlatform('platform.connectors:manage')
  @Post('/connectors/:connectorId/revoke')
  revokeConnector(@Param('connectorId') connectorId: string, @Res() ctx: Context) {
    return handle(ctx, async () => {
      await this.registry.revoke(connectorId);
      await this.audit.record(this.actor, 'connector.revoked', { type: 'connector', id: connectorId });
      return { id: connectorId, status: 'revoked' };
    }, 'Failed to revoke');
  }

  @RequirePlatform('platform.staff:manage')
  @Get('/staff')
  listStaff(@Res() ctx: Context) {
    return handle(ctx, () => this.staff.list(), 'Failed to list staff');
  }

  @RequirePlatform('platform.staff:manage')
  @Post('/staff')
  inviteStaff(@Res() ctx: Context) {
    return handle(ctx, async () => this.staff.invite(await this.request.json()), 'Failed to invite', 201);
  }

  @RequirePlatform('platform.staff:manage')
  @Put('/staff/:staffId')
  updateStaff(@Param('staffId') staffId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.staff.update(staffId, await this.request.json()), 'Failed to update');
  }

  /**
   * Restore an administrator of an institution that locked itself out (docs/plans/15 §14), after verifying the request
   * out of band: `{ email, name?, reason, ticket }`. Audited on both sides; the institution's administrators are told.
   */
  @RequirePlatform('platform.tenants:recover')
  @Post('/tenants/:domain/recover-access')
  recoverAccess(@Param('domain') domain: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.recovery.recover({ id: this.user.userId, email: this.user.email }, domain, await this.request.json()), 'Failed to restore access', 201);
  }

  @RequirePlatform('platform.audit:read')
  @Get('/audit')
  auditLog(@Res() ctx: Context) {
    const q = new URL(this.request.url).searchParams;
    return handle(ctx, () => this.audit.list({ tenant: q.get('tenant') ?? undefined, action: q.get('action') ?? undefined, limit: q.get('limit') ? Number(q.get('limit')) : undefined }), 'Failed to read the audit log');
  }

  @RequirePlatform('platform.support_access:request')
  @Post('/support-access')
  requestAccess(@Res() ctx: Context) {
    return handle(ctx, async () => this.support.request(await this.request.json()), 'Failed to request access', 201);
  }

  @RequirePlatform('platform.support_access:request')
  @Get('/support-access')
  myRequests(@Res() ctx: Context) {
    return handle(ctx, () => this.support.mine(), 'Failed to list requests');
  }
}

/** The institution's side of support access: approve, deny, revoke (`support_access:approve`). */
@Controller({ path: '/support-access', scope: Scope.REQUEST })
export class SupportAccessHandler {
  constructor(@Inject(SupportAccessService) private readonly support: SupportAccessService) { }

  @Require('support_access:approve')
  @Get()
  list(@Res() ctx: Context) {
    return handle(ctx, () => this.support.list(), 'Failed to list support access');
  }

  @Require('support_access:approve')
  @Post('/:grantId/approve')
  approve(@Param('grantId') grantId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.support.decide(grantId, 'approve'), 'Failed to approve');
  }

  @Require('support_access:approve')
  @Post('/:grantId/deny')
  deny(@Param('grantId') grantId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.support.decide(grantId, 'deny'), 'Failed to deny');
  }

  @Require('support_access:approve')
  @Post('/:grantId/revoke')
  revoke(@Param('grantId') grantId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.support.revoke(grantId), 'Failed to revoke');
  }
}
