import { InvitationsService } from "../services/invitations.service";
import { RolesService } from "../services/roles.service";
import { LogsService } from "../services/logs.service";
import { Scope, Inject, Controller, Get, Patch, Post, Req, Res, type RawBodyRequest } from "@nestjs/common";
import type { HonoRequest } from "hono/request";
import type { Context } from "hono";
import type { User, Tenant, AfterLoginRequest, AfterLoginResponse } from "@repo/fintivio/schemas";
import { TriggerBuilder } from "@repo/fintivio/utilities";
import assert from "assert";
import { USER } from "../injector/tokens/user.token";
import { TENANT } from "../injector/tokens/tenant.token";

@Controller({
  path: '/auth',
  scope: Scope.REQUEST
})
export class AuthHandler {
  constructor(
    @Inject(InvitationsService) private invitationsService: InvitationsService,
    @Inject(RolesService) private rolesService: RolesService,
    @Inject(LogsService) private logsService: LogsService,
    @Inject(USER) protected readonly user?: User,
    @Inject(TENANT) protected readonly tenant?: Tenant,
  ) { }

  @Patch('/invitations-roles')
  async matchInvitationsRoles(@Res() ctx: Context): Promise<void> {
    assert(this.user, 'User is required');

    const invitation = this.user.email && await this.invitationsService.getInvitationByEmail(this.user.email);

    if (!invitation) {
      ctx.res = new Response(null, { status: 204 });
      return;
    }

    const { role } = invitation.data as Record<string, unknown>;

    await this.rolesService.createUserRole({
      roleId: role as string,
      userId: this.user.userId,
    });

    await this.logsService.info('User roles matched from invitation', {
      category: 'security',
      source: 'AuthActions',
      userId: this.user.userId,
      metadata: {
        email: this.user.email,
        role: role as string
      }
    });
    ctx.res = new Response(null, { status: 204 });
    return;
  }

  @Get('/roles')
  async getUserRoles(@Res() ctx: Context): Promise<void> {
    if (!this.user) {
      await this.logsService.error('User is undefined, cannot get roles.', {
        category: 'security',
        source: 'AuthService',
      });
      ctx.res = new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
      return;
    }
    const roles = await this.rolesService.getRolesByUserId({ userId: this.user.userId });

    await this.logsService.debug('User roles retrieved', {
      category: 'security',
      source: 'AuthService',
      userId: this.user.userId,
      metadata: {
        roles: roles,
      },
    });

    ctx.res = new Response(JSON.stringify(roles), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  @Post('/after-login')
  async afterLogin(@Req() req: RawBodyRequest<HonoRequest>, @Res() ctx: Context): Promise<void> {
    const body: AfterLoginRequest = await (req.raw as any).json();
    const { firstSeen } = body;

    let responsePayload: AfterLoginResponse;

    if (this.tenant) {
      assert(this.user, 'User is required');
      assert(this.logsService, 'Logs service is required');

      await this.matchInvitationsRolesInternal();

      await this.logsService.info(firstSeen ? TriggerBuilder.Events.USER_SIGNUP : TriggerBuilder.Events.USER_SIGNIN, {
        category: TriggerBuilder.Categories.SECURITY,
        source: TriggerBuilder.Sources.AUTH,
        userId: this.user.userId,
        metadata: {
          eventName: firstSeen ? TriggerBuilder.Events.USER_SIGNUP : TriggerBuilder.Events.USER_SIGNIN,
          firstSeen,
          tenant: this.tenant.domain,
          email: this.user.email,
          userId: this.user.userId,
        }
      });

      responsePayload = { redirectPath: '/dashboard' };
    } else {
      responsePayload = { redirectPath: '/onboarding' };
    }

    ctx.res = new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return;
  }

  private async matchInvitationsRolesInternal(): Promise<void> {
    assert(this.user, 'User is required');

    const invitation = this.user.email && await this.invitationsService.getInvitationByEmail(this.user.email);

    if (!invitation) {
      return;
    }

    const { role } = invitation.data as Record<string, unknown>;

    await this.rolesService.createUserRole({
      roleId: role as string,
      userId: this.user.userId,
    });

    await this.logsService.info('User roles matched from invitation', {
      category: 'security',
      source: 'AuthActions',
      userId: this.user.userId,
      metadata: {
        email: this.user.email,
        role: role as string
      }
    });
  }
}