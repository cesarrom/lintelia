'use client';
import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useSession, useUser } from '@descope/react-sdk';
import { useTenant } from '../providers/TenantProvider';
import { Tenant } from '@repo/fintivio/schemas';

type User = ReturnType<typeof useUser>['user'];

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenant: Tenant | null;
  permissions: string[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  hasPermission: (permission: string | string[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AP = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user, isUserLoading } = useUser();
  const navigate = (url: string) => {
    window.location.href = url;
  }
  const { tenant, isLoading: isTenantLoading } = useTenant();
  // const { data: roles = [], isLoading: isRolesLoading } = useRolesGetRoles({ userId: user?.userId, enabled: !isUserLoading });
  const permissions = user?.userTenants?.flatMap(t => t.tenantId === tenant?.domain ? t.roleNames || [] : []) || [];


  const handleLogout = async () => {
    navigate('/sign-out');
  };

  const hasPermission = (requiredPermissions: string | string[]): boolean => {
    const permissionsToCheck = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    // Super admin has all permissions
    if (permissions.includes('super_admin')) {
      return true;
    }

    // Admin has all permissions except super_admin specific ones
    if (permissions.includes('admin')) {
      return !permissionsToCheck.includes('super_admin');
    }

    // Check if user has any of the required permissions
    return permissionsToCheck.some(permission => permissions.includes(permission));
  };

  const value = {
    isAuthenticated,
    isLoading: isSessionLoading || isUserLoading || isTenantLoading,
    user: user || null,
    tenant: tenant || null,
    permissions,
    isSuperAdmin: permissions.includes('super_admin'),
    isAdmin: permissions.includes('admin'),
    hasPermission,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const WrappedAuthProvider = ({ children }: React.PropsWithChildren) => {
  return (
    
      <AP>
        {children}
      </AP>
  )
}

export {
  WrappedAuthProvider as AuthProvider
}