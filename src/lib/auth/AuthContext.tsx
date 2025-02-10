'use client';
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { useSession, useDescope, useUser } from '@descope/nextjs-sdk/client';
import { AuthProvider } from '@descope/nextjs-sdk';

export interface UserPermissions {
  workflows: ('view' | 'create' | 'edit' | 'delete' | 'execute')[];
  users: ('view' | 'invite' | 'edit' | 'delete')[];
  roles: ('view' | 'create' | 'edit' | 'delete')[];
  analytics: ('view' | 'export')[];
}

type User = ReturnType<typeof useUser>['user'];

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenant: string | null;
  permissions: UserPermissions;
  isSuperAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AP = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isSessionLoading: isLoading } = useSession();
  const { user } = useUser();
  const { logout: descopeLogout } = useDescope();
  const [permissions, setPermissions] = useState<UserPermissions>({
    workflows: [],
    users: [],
    roles: [],
    analytics: []
  });

  // In a real implementation, you would fetch these from your backend
  useEffect(() => {
    if (user) {
      const roles = user.roleNames || [];
      const isSuperAdmin = roles.includes('super_admin');

      if (isSuperAdmin) {
        // Give all permissions to super admin
        setPermissions({
          workflows: ['view', 'create', 'edit', 'delete', 'execute'],
          users: ['view', 'invite', 'edit', 'delete'],
          roles: ['view', 'create', 'edit', 'delete'],
          analytics: ['view', 'export'],
        });
      } else {
        // TODO: Fetch user's role permissions from backend
        setPermissions({
          workflows: [],
          users: [],
          roles: [],
          analytics: []
        });
      }
    }
  }, [user]);

  const handleLogout = async () => {
    await descopeLogout();
  };

  const value = {
    isAuthenticated,
    isLoading,
    user: user || null,
    tenant: null, // This will be set based on subdomain
    permissions,
    isSuperAdmin: user?.roleNames?.includes('super_admin') || false,
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

const WrappedAuthProvider = ({ children, projectId }: React.PropsWithChildren<{ projectId: string }>) => {
  return (
    <AuthProvider projectId={projectId}>
      <AP>
        {children}
      </AP>
    </AuthProvider>
  )
}

export {
  WrappedAuthProvider as AuthProvider
}