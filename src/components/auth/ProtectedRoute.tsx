import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/router';
import { UserPermissions } from '@/lib/auth/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: Partial<UserPermissions>;
}

export const ProtectedRoute = ({ children, requiredPermissions }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, permissions } = useAuth();
  const router = useRouter();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  if (requiredPermissions) {
    const hasRequiredPermissions = Object.entries(requiredPermissions).every(
      ([key, required]) => {
        if (!required) return true;
        return permissions[key as keyof UserPermissions];
      }
    );

    if (!hasRequiredPermissions) {
      return <div>You don&apos;t have permission to access this page.</div>;
    }
  }

  return <>{children}</>;
}; 