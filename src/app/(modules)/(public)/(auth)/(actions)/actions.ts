'use server';

import { env } from "@/lib/constants";
import { ENVIRONMENT_TOKEN } from "@/lib/injector/tokens";
import { inject, optional, token } from "@/lib/injector/utils";
import { InvitationsService, UserService } from "@/lib/services";
import { EventsService } from "@/lib/services/events.service";
import assert from "assert";
import { redirect } from "next/navigation";

export const matchInvitationsRoles = inject(
  [InvitationsService, UserService],
  async ({ user }, [invitationsService, userRolesService]) => {
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
  }
);

export const getUserRoles = inject(
  [UserService],
  async ({ user }, [userRolesService]) => {
    assert(user, 'User is required');
    return userRolesService.getRolesByUserId({ userId: user.userId });
  }
);

export const verifyIdentity = inject(
  [token<typeof env>(ENVIRONMENT_TOKEN)],
  async ({ user }, [environment], person: { givenName: string, familyName: string, primaryEmail: string, primaryPhone: string }) => {
    assert(user, 'User is required');

    const verifyPersonBody = {
      appDomain: environment.DOMAIN, // your product app domain (e.g. ‘example.com’).
      totApiKey: environment.KYC_TOKEN,
      totSecretKey: environment.KYC_SECRET,
      appUserid: user.userId, // you define - unique user constant.
      person,
    };

    const response = await fetch(`https://${environment.KYC_ENDPOINT}/api/person`, {
      method: "POST",
      body: JSON.stringify(verifyPersonBody),
      headers: {
        "Content-Type": "application/json",
      }
    }).then(res => res.json());

    const content = (response && response.content) || {};

    if (content.code === "WorkflowService:conditionsMet") {
      return { verificationRequired: false, continuation: undefined };
    }

    return { verificationRequired: true, continuation: content.continuation };
  }
);

export const afterLogin = inject(
  [optional<EventsService>(EventsService)],
  async ({ user, tenant }, [eventsService], firstSeen: boolean) => {
    if (tenant) {
      assert(user, 'User is required');
      assert(eventsService, 'Events service is required');

      await matchInvitationsRoles();
      await eventsService.logEvent(firstSeen ? 'sign-up' : 'sign-in', { userId: user.userId });

      return redirect('/dashboard');
    }

    return redirect('/onboarding');
  }
);