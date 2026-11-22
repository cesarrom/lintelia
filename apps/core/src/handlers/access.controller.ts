import { Controller, Delete, Get, Inject, Param, Patch, Post, Put, Res, Scope } from '@nestjs/common';
import type { Context } from 'hono';
import type { Tenant, User } from '@repo/lintelia/schemas';
import { Access, Require, RequireAny } from '../auth/access';
import { TENANT } from '../injector/tokens/tenant.token';
import { USER } from '../injector/tokens/user.token';
import { type AppRequest, REQUEST_PROXY } from '../injector/tokens/request-proxy.token';
import { handle, jsonError } from '../http/respond';
import { AccessQueriesService } from '../access/queries.service';
import { MemberAttributesService } from '../access/attributes';
import { AuditWriter } from '../services/audit.writer';
import { RolesService } from '../services/roles.service';
import { CustomPermissionsService } from '../access/custom-permissions.service';
import { AccessChanges, actorOf } from '../access/changes';

const keyOf = (raw: string) => {
  const key = decodeURIComponent(raw);
  return key.startsWith('custom:') ? key : `custom:${key}`;
};

/**
 * The institution's permission catalogue and its custom permissions (docs/plans/15 §5.1), and the log of access
 * changes with their approvals (§14).
 */
@Controller({ scope: Scope.REQUEST })
export class AccessHandler {
  constructor(
    @Inject(RolesService) private readonly roles: RolesService,
    @Inject(CustomPermissionsService) private readonly custom: CustomPermissionsService,
    @Inject(AccessChanges) private readonly changes: AccessChanges,
    @Inject(TENANT) private readonly tenant: Tenant,
    @Inject(USER) private readonly user: User,
    @Inject(REQUEST_PROXY) private readonly request: AppRequest,
    @Inject(AccessQueriesService) private readonly queries: AccessQueriesService,
    @Inject(AuditWriter) private readonly audit: AuditWriter,
    @Inject(MemberAttributesService) private readonly attributes: MemberAttributesService,
  ) { }

  /** Built-in and custom permissions (not sensitive: every member may read it; role and API client dialogs use it). */
  @Access('member')
  @Get('/permissions')
  permissions(@Res() ctx: Context) {
    return handle(ctx, () => this.roles.listPermissions(), 'Failed to list permissions');
  }

  /** Designers name the capability their screen or workflow needs; it grants nothing until a role holds it. */
  @RequireAny('roles:manage', 'workflows:manage')
  @Post('/permissions/custom')
  create(@Res() ctx: Context) {
    return handle(ctx, async () => this.custom.create(await this.request.json()), 'Failed to create the permission', 201);
  }

  @Require('roles:manage')
  @Put('/permissions/custom/:key')
  update(@Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.custom.update(keyOf(key), await this.request.json()), 'Failed to update the permission');
  }

  /** Archive: nobody holds it any more (revocation, at once). */
  @Require('roles:manage')
  @Delete('/permissions/custom/:key')
  archive(@Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, () => this.custom.archive(keyOf(key)), 'Failed to archive the permission');
  }

  @Require('roles:manage')
  @Post('/permissions/custom/:key/restore')
  restore(@Param('key') key: string, @Res() ctx: Context) {
    return handle(ctx, () => this.custom.restore(keyOf(key)), 'Failed to restore the permission');
  }

  /** Roles × permissions (built-in and custom), the matrix of the Roles page. */
  @Require('roles:read')
  @Get('/access/matrix')
  matrix(@Res() ctx: Context) {
    return handle(ctx, () => this.queries.matrix(), 'Failed to build the matrix');
  }

  /** Who holds a permission (roles, members through them, API clients) and which workflows require it. */
  @Require('roles:read', 'members:read')
  @Get('/access/who')
  who(@Res() ctx: Context) {
    const permission = new URL(this.request.url).searchParams.get('permission') ?? '';
    return handle(ctx, () => this.queries.whoCan(permission), 'Failed to answer who holds the permission');
  }

  /** A member's roles (and where each came from), permissions and what they open. */
  @Require('roles:read', 'members:read')
  @Get('/users/:userId/access')
  memberAccess(@Param('userId') userId: string, @Res() ctx: Context) {
    return handle(ctx, () => this.queries.memberAccess(userId), 'Failed to load the member access');
  }

  /** Every active assignment as CSV (access reviews, auditors); the export itself is audited. */
  @Require('roles:read', 'members:read')
  @Get('/access/export')
  async export(@Res() ctx: Context) {
    try {
      const csv = await this.queries.exportAssignments();
      await this.audit.record(this.tenant.id, { type: this.user.kind, id: this.user.userId, email: this.user.email }, 'access.exported', { type: 'tenant', id: this.tenant.id }, {});
      ctx.res = new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="access-${this.tenant.domain}-${new Date().toISOString().slice(0, 10)}.csv"` } });
    } catch (error) {
      jsonError(ctx, error, 'Failed to export');
    }
  }

  /** The member attributes the institution declared (branch, region…) and where their values come from. */
  @Require('members:read')
  @Get('/member-attributes')
  attributesList(@Res() ctx: Context) {
    return handle(ctx, () => this.attributes.list(), 'Failed to list the attributes');
  }

  @Require('members:update')
  @Put('/member-attributes')
  attributesSave(@Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{ attributes?: unknown }>();
      return this.attributes.save(body.attributes);
    }, 'Failed to save the attributes');
  }

  /** Set a member's manual attributes (`{ key: value }`; IdP ones are read-only). */
  @Require('members:update')
  @Patch('/users/:userId/attributes')
  attributesSet(@Param('userId') userId: string, @Res() ctx: Context) {
    return handle(ctx, async () => this.attributes.setValues(userId, await this.request.json()), 'Failed to change the attributes');
  }

  /** Access changes: pending approvals, scheduled changes and what was applied (`?status=pending_approval,scheduled`). */
  @RequireAny('roles:read', 'security:manage', 'audit:read')
  @Get('/access-changes')
  list(@Res() ctx: Context) {
    const status = new URL(this.request.url).searchParams.get('status') ?? undefined;
    return handle(ctx, () => this.changes.list(this.tenant, actorOf(this.user), { status }), 'Failed to list access changes');
  }

  @RequireAny('roles:read', 'security:manage', 'audit:read')
  @Get('/access-changes/:id')
  get(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.changes.get(this.tenant, actorOf(this.user), id), 'Failed to load the access change');
  }

  /** A second administrator approves (they must not be the requester and must be able to make the change themselves). */
  @Access('member')
  @Post('/access-changes/:id/approve')
  approve(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{ reason?: string }>().catch(() => ({} as { reason?: string }));
      return this.changes.approve(this.tenant, actorOf(this.user), id, body?.reason);
    }, 'Failed to approve the change');
  }

  @Access('member')
  @Post('/access-changes/:id/reject')
  reject(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, async () => {
      const body = await this.request.json<{ reason?: string }>().catch(() => ({} as { reason?: string }));
      return this.changes.reject(this.tenant, actorOf(this.user), id, body?.reason);
    }, 'Failed to reject the change');
  }

  /** The requester (or an administrator) withdraws a change that waits for approval or its date. */
  @Access('member')
  @Post('/access-changes/:id/cancel')
  cancel(@Param('id') id: string, @Res() ctx: Context) {
    return handle(ctx, () => this.changes.cancel(this.tenant, actorOf(this.user), id), 'Failed to cancel the change');
  }
}
