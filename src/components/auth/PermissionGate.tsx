import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { UserPermissions } from '@/lib/auth/AuthContext';

interface PermissionGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  permissions: Partial<UserPermissions>;
}

export const PermissionGate = ({ children, fallback = null, permissions }: PermissionGateProps) => {
  const { permissions: userPermissions, isSuperAdmin } = useAuth();

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  const hasPermissions = Object.entries(permissions).every(
    ([key, required]) => {
      if (!required) return true;
      return userPermissions[key as keyof UserPermissions];
    }
  );

  if (!hasPermissions) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}; 