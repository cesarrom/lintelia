import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';

interface PermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  permissions: string[];
}

export const PermissionGate = ({ children, fallback = null, permissions }: PermissionGateProps) => {
  const { permissions: userPermissions, isSuperAdmin, isAdmin } = useAuth();

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  const hasPermissions = permissions.some(
    (permission) => {
      return userPermissions.includes(permission) || isSuperAdmin || isAdmin;
    }
  );

  if (!hasPermissions) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}; 