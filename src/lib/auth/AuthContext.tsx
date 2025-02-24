'use client';
import { createContext, useContext, ReactNode, useEffect, useState, useTransition } from 'react';
import { useSession, useUser } from '@descope/nextjs-sdk/client';
import { AuthProvider } from '@descope/nextjs-sdk';
import { useRouter } from 'next/navigation';
import { getUserRoles } from '@/app/(modules)/(public)/(auth)/(actions)/actions';

type User = ReturnType<typeof useUser>['user'];

export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  tenant: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AP = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isSessionLoading: isLoading } = useSession();
  const { user } = useUser();
  const navigate = useRouter();
  const [_, startTransition] = useTransition();
  const [permissions, setPermissions] = useState<string[]>([]);

  // In a real implementation, you would fetch these from your backend
  useEffect(() => {
    if (!user) { return };
    startTransition(async () => {
      try {
        const roles = await getUserRoles();
        setPermissions(roles);
      } catch (error) {
        console.error(error);
      }
    });
  }, [user]);

  const handleLogout = async () => {
    navigate.replace('/sign-out');
  };

  console.log({
    permissions,
    user,
  });

  const value = {
    isAuthenticated,
    isLoading,
    user: user || null,
    tenant: null, // This will be set based on subdomain
    permissions,
    isSuperAdmin: permissions.includes('super_admin'),
    isAdmin: permissions.includes('admin'),
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