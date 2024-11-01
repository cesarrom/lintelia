'use client';

import { SignUpOrInFlow } from '@descope/nextjs-sdk';
import React from 'react';
import Cookie from 'js-cookie';
import { getTenant } from '@/actions/tenants';
import { matchInvitationRoles } from '@/actions/users';

export function SignOn() {
  const [_, startTransition] = React.useTransition();
  return (
    <SignUpOrInFlow
      redirectAfterSuccess="/onboarding"
      onSuccess={data => {
        startTransition(async () => {
          const isLocal = window.location.hostname.includes('local.fintivio.org');
          let redirectUri = '/onboarding';

          try {
            const tenant = await getTenant();
            redirectUri = await matchInvitationRoles(data.detail.user?.userId, tenant.domain);
          } catch (e) {
            console.error(e);
          }

          if (isLocal) {
            // we set the JWT as a cookie called DS
            Cookie.set('DS', data.detail.sessionJwt);
            window.location.href = redirectUri;
          }
        })




      }}
    />
  );
}