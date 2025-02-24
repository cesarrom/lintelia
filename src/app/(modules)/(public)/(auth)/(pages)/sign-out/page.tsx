'use client';

import { useEffect } from 'react';
import { useDescope } from '@descope/nextjs-sdk/client';
import { useRouter } from 'next/navigation';

export default function SignOutPage() {
  const navigate = useRouter()
  const descope = useDescope();

  useEffect(() => {
    navigate.replace('/sign-on');
    descope.logout();
  }, [descope, navigate]);

  return null;
}
