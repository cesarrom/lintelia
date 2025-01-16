'use server'

import { session } from "@descope/nextjs-sdk/server"
import { auth } from "@fintivio-sst/core/clients/auth.client";
import { ApplicationsService, InvitationsService, UserRolesService, env, getInjector } from '@fintivio-sst/core/index';
import { ENVIRONMENT_TOKEN } from "@fintivio-sst/core/libs/injector/tokens";

export const getUser = async (id?: string) => {
  const s = session();
  const user = await auth.management.user.loadByUserId(id || s?.token?.sub || '');

  return user?.data || null;
}

export type User = Awaited<ReturnType<typeof getUser>>;

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

export const verifyIdentity = async (domain: string, person: { givenName: string, familyName: string, primaryEmail: string, primaryPhone: string }) => {
  const user = await getUser();
  const injector = await getInjector(domain);
  const environment = injector.resolve(ENVIRONMENT_TOKEN) as typeof env;

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

  var content = (response && response.content) || {};

  if (content.code === "WorkflowService:conditionsMet") {
    return { verificationRequired: false, continuation: undefined };
  }

  return { verificationRequired: true, continuation: content.continuation };

}

export type Role = Awaited<ReturnType<typeof getUserRole>>;