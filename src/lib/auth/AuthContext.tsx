'use client';
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { User, useAuth0 } from '@auth0/auth0-react';
import { isSuperAdmin } from '../auth0-config';
import { RolePermissions } from '../permissions/types';

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenant: string | null;
  permissions: RolePermissions;
  isSuperAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, user, logout: auth0Logout } = useAuth0();
  const [permissions, setPermissions] = useState<RolePermissions>({});

  // In a real implementation, you would fetch these from your backend
  useEffect(() => {
    if (user) {
      const superAdmin = isSuperAdmin(user.email || '');
      if (superAdmin) {
        // Give all permissions to super admin
        setPermissions({
          workflows: ['view', 'create', 'edit', 'delete', 'execute'],
          users: ['view', 'invite', 'edit', 'delete'],
          roles: ['view', 'create', 'edit', 'delete'],
          analytics: ['view', 'export'],
        });
      } else {
        // TODO: Fetch user's role permissions from backend
        setPermissions({});
      }
    }
  }, [user]);

  const handleLogout = async () => {
    await auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const value = {
    isAuthenticated,
    isLoading,
    user: user || null,
    tenant: null, // This will be set based on subdomain
    permissions,
    isSuperAdmin: user ? isSuperAdmin(user.email || '') : false,
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