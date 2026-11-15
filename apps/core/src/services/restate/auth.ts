import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { RestateService } from "./restate.abstract.service";
import { InvitationsService } from "../../services/invitations.service";
import { RolesService } from "../../services/roles.service";
import { LogsService } from "../../services/logs.service";
import { USER } from "../../injector/tokens/user.token";
import { TENANT } from "../../injector/tokens/tenant.token";
import { Inject, Scope, Injectable } from "@nestjs/common";
import type { User, Tenant, AfterLoginRequest, AfterLoginResponse } from "@repo/fintivio/schemas";
import { TriggerBuilder } from "@repo/fintivio/utilities";
import assert from "assert";

@Injectable({
  scope: Scope.REQUEST
})
export class AuthService extends RestateService<'auth'> {
  object = object({
    name: "auth",
    handlers: {
      matchInvitationsRoles: async (_c: ObjectContext): Promise<void> => {
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
      },

      getUserRoles: async (_c: ObjectContext): Promise<string[]> => {
        if (!this.user) {
          await this.logsService.error('User is undefined, cannot get roles.', {
            category: 'security',
            source: 'AuthService',
          });
          return [];
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

        return roles
      },

      afterLogin: async (c: ObjectContext, request: AfterLoginRequest): Promise<AfterLoginResponse> => {
        const { firstSeen } = request;

        if (this.tenant) {
          assert(this.user, 'User is required');
          assert(this.logsService, 'Logs service is required');

          // const client = c.objectSendClient(this.object, c.key);

          // client.matchInvitationsRoles();

          this.logsService.info(firstSeen ? TriggerBuilder.Events.USER_SIGNUP : TriggerBuilder.Events.USER_SIGNIN, {
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

          return { redirectPath: '/dashboard' };
        }

        return { redirectPath: '/onboarding' };
      },
    },
  });

  constructor(
    @Inject(InvitationsService) private invitationsService: InvitationsService,
    @Inject(RolesService) private rolesService: RolesService,
    @Inject(LogsService) private logsService: LogsService,
    @Inject(USER) protected readonly user?: User,
    @Inject(TENANT) protected readonly tenant?: Tenant,
  ) {
    super();
  }
}