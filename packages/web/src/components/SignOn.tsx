'use client';

import { SignUpOrInFlow } from '@descope/nextjs-sdk';

export function SignOn() {
  return (
    <SignUpOrInFlow
      onSuccess={(e) => console.log('Logged in!')}
      onError={(e) => console.log('Could not logged in!')}
      redirectAfterSuccess="/onboarding"
    />
  );
}