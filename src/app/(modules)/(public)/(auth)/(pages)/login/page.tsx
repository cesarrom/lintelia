'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const LoginPage = () => {
  const router = useRouter();

  useEffect(() => {
    router.push('/sign-on');
  }, [router]);

  return null;
};

export default LoginPage;
