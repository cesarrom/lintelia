'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/lib/permissions/usePermissions';
import { PermissionCheck } from '@/lib/permissions/types';

interface PermissionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requires: PermissionCheck | PermissionCheck[];
}

export function PermissionGuard({ children, fallback = null, requires }: PermissionGuardProps) {
  const { can } = usePermissions();

  if (!can(requires)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
} 