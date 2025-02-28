'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

interface PermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  permissions: string | string[];
}

export const PermissionGate = ({ children, fallback = null, permissions }: PermissionGateProps) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(permissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}; 