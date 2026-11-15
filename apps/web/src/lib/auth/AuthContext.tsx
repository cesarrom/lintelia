import { createContext, useContext, type ReactNode } from 'react';
import type { Tenant, User } from '@repo/fintivio/schemas';
import { useAuthActions, useSession, useUser } from './session';
import { useTenant } from '../providers/TenantProvider';

/**
 * Who is signed in and what they may do. Permissions come from the API (effective permissions of the member's roles,
 * or `platform.*` permissions for staff; clients have none). The UI only hides what the API would refuse anyway.
 */
export interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  kind: User['kind'] | null;
  tenant: Tenant | null;
  permissions: string[];
  roles: string[];
  isAdmin: boolean;
  /** True when the user holds at least one of the permissions. */
  hasPermission: (permission: string | string[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isSessionLoading } = useSession();
  const { user, isUserLoading } = useUser();
  const { logout } = useAuthActions();
  const { tenant, isLoading: isTenantLoading } = useTenant();

  const permissions = user?.permissions ?? [];
  const roles = user?.userTenants?.flatMap((t) => t.roleNames ?? []) ?? [];

  const hasPermission = (required: string | string[]) => {
    const list = Array.isArray(required) ? required : [required];
    return list.some((permission) => permissions.includes(permission));
  };

  const handleLogout = async () => {
    const home = user?.kind === 'client' ? '/sign-on?client=1' : '/sign-on';
    await logout();
    window.location.href = home;
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading: isSessionLoading || isUserLoading || isTenantLoading,
    user: user ?? null,
    kind: user?.kind ?? null,
    tenant: tenant ?? null,
    permissions,
    roles,
    isAdmin: roles.includes('admin'),
    hasPermission,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export { AuthProvider };
