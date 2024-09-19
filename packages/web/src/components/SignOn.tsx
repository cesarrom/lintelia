'use client';

import { createUser } from '@/actions/users/createUser';
import { useSession } from '@/providers/session/session.provider';
import { SignUpOrInFlow } from '@descope/nextjs-sdk';
import React from 'react';

export function SignOn() {
  const { session } = useSession();

  const [_, startTransition] = React.useTransition();

  console.log(session);

  return (
    <SignUpOrInFlow redirectAfterSuccess="/onboarding" onSuccess={data => {
      if (!session.tenant?.domain) {
        return;
      }

      startTransition(async () => {
        await createUser({
          email: data.detail.user.email,
          phoneNumber: data.detail.user.phone,
          id: data.detail.user.userId,
          role: 'user',
        }, session.tenant.domain).catch(console.error);
      });
    }} />
  );
}