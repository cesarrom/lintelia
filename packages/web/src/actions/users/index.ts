'use server'

import { session } from "@descope/nextjs-sdk/server"
import { auth } from "@fintivio-sst/core/clients/auth.client";
import { ApplicationsService, InvitationsService, UserRolesService, getInjector } from '@fintivio-sst/core/index';

export const getUser = async (id?: string) => {
  const s = session();
  const user = await auth.management.user.loadByUserId(id || s.token.sub!);

  return user.data;
}

export const getUserRole = async (userId: string, domain: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(UserRolesService);

  return applicationsService.getRoleByUserId(userId);
}

export const matchInvitationRoles = async (userId: string, domain: string) => {
  const injector = await getInjector(domain);

  const user = await getUser(userId);

  const userRolesService = injector.resolve(UserRolesService);
  const invitationsService = injector.resolve(InvitationsService);


  const invitation = await invitationsService.getInvitationByEmail(user.email);

  if (!invitation) {
    return `/onboarding`;
  }

  const { role, applicationId } = JSON.parse(invitation.data);

  await userRolesService.createUserRole({
    role,
    userId,
  });

  if (invitation.purpose === 'co-applicant') {
    const applicationsService = injector.resolve(ApplicationsService);
    await applicationsService.linkApplicant(applicationId, userId);
    return `/onboarding/co-applicant?parentApplicationId=${applicationId}`;
  }

  return `/onboarding`;
}

export type Role = Awaited<ReturnType<typeof getUserRole>>;