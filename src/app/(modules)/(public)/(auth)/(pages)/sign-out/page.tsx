'use client';

import { useEffect } from 'react';
import { useDescope } from '@descope/nextjs-sdk/client';
import { useRouter } from 'next/navigation';

export default function SignOutPage() {
  const navigate = useRouter()
  const descope = useDescope();

  useEffect(() => {
    descope.logout();
    navigate.replace('/sign-on');
  }, [descope, navigate]);

  return null;
}
