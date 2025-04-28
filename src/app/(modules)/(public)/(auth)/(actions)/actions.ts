'use server';

import { optional } from "@/lib/services/service";
import { inject } from "@/lib/injector/utils";
import { EnvironmentsService } from "@/lib/services/environments.service";
import { InvitationsService } from "@/lib/services/invitations.service";
import { LogsService } from "@/lib/services/logs.service";
import { RolesService } from "@/lib/services/roles.service";
import { SystemTriggersService } from "@/lib/services/system-triggers.service";
import { TriggerBuilder } from "@/lib/triggers-utils";
import assert from "assert";
import { redirect } from "next/navigation";

export const matchInvitationsRoles = inject(
  [InvitationsService, RolesService, LogsService],
  async ({ user }, [invitationsService, userRolesService, logs]) => {
    assert(user, 'User is required');

    const invitation = user.email && await invitationsService.getInvitationByEmail(user.email);

    if (!invitation) {
      return;
    }

    const { role } = invitation.data;

    await userRolesService.createUserRole({
      roleId: role as string,
      userId: user.userId,
    });

    await logs.info('User roles matched from invitation', {
      category: 'security',
      source: 'AuthActions',
      userId: user.userId,
      metadata: {
        email: user.email,
        role: role as string
      }
    });
  }
);

export const getUserRoles = inject(
  [RolesService, LogsService],
  async ({ user }, [userRolesService, logs]) => {
    assert(user, 'User is required');
    const roles = await userRolesService.getRolesByUserId({ userId: user.userId });

    await logs.debug('User roles retrieved', {
      category: 'security',
      source: 'AuthActions',
      userId: user.userId,
      metadata: {
        roles
      }
    });

    return roles;
  }
);

export const verifyIdentity = inject(
  [EnvironmentsService, LogsService],
  async ({ user }, [environmentsService, logs], person: { givenName: string, familyName: string, primaryEmail: string, primaryPhone: string }) => {
    assert(user, 'User is required');

    try {
      const verifyPersonBody = {
        appDomain: environmentsService.env.DOMAIN,
        totApiKey: environmentsService.env.KYC_TOKEN,
        totSecretKey: environmentsService.env.KYC_SECRET,
        appUserid: user.userId,
        person,
      };

      const response = await fetch(`https://${environmentsService.env.KYC_ENDPOINT}/api/person`, {
        method: "POST",
        body: JSON.stringify(verifyPersonBody),
        headers: {
          "Content-Type": "application/json",
        }
      }).then(res => res.json());

      const content = (response && response.content) || {};

      const verificationRequired = content.code !== "WorkflowService:conditionsMet";

      await logs.info('Identity verification attempt', {
        category: 'security',
        source: 'AuthActions',
        userId: user.userId,
        metadata: {
          verificationRequired,
          person: {
            givenName: person.givenName,
            familyName: person.familyName,
            email: person.primaryEmail
          },
          continuation: content.continuation
        }
      });

      return { 
        verificationRequired, 
        continuation: content.continuation 
      };
    } catch (error) {
      await logs.error('Identity verification failed', {
        category: 'security',
        source: 'AuthActions',
        userId: user.userId,
        metadata: {
          person: {
            givenName: person.givenName,
            familyName: person.familyName,
            email: person.primaryEmail
          },
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
);

export const afterLogin = inject(
  [optional<LogsService>(LogsService), optional<SystemTriggersService>(SystemTriggersService)],
  async ({ user, tenant }, [logs], firstSeen: boolean) => {
    if (tenant) {
      assert(user, 'User is required');
      assert(logs, 'Logs service is required');

      await matchInvitationsRoles();

      await logs.info(firstSeen ? TriggerBuilder.Events.USER_SIGNUP : TriggerBuilder.Events.USER_SIGNIN, {
        category: TriggerBuilder.Categories.SECURITY,
        source: TriggerBuilder.Sources.AUTH,
        userId: user.userId,
        metadata: {
          eventName: firstSeen ? TriggerBuilder.Events.USER_SIGNUP : TriggerBuilder.Events.USER_SIGNIN,
          firstSeen,
          tenant: tenant.domain,
          email: user.email,
          userId: user.userId,
        }
      });

      return redirect('/dashboard');
    }

    return redirect('/onboarding');
  }
);