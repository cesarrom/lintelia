'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string | string[];
}

export const ProtectedRoute = ({ children, requiredPermissions }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    router.push('/sign-in');
    return null;
  }

  if (requiredPermissions && !hasPermission(requiredPermissions)) {
    return <div>You don&apos;t have permission to access this page.</div>;
  }

  return <>{children}</>;
}; 