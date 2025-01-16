"use client"
import React, { createContext, useContext } from 'react';
import { GetTenant } from '@/actions/tenants';
import { User } from '@/actions/users';

interface SessionContextType {
  tenant: GetTenant | null;
  user: User | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useAppSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useAppSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider: React.FC<React.PropsWithChildren<Omit<SessionContextType, 'setSession'>>> = ({ children, tenant, user }) => {
  return (
    <SessionContext.Provider value={{ tenant, user }}>
      {children}
    </SessionContext.Provider>
  );
};

export function useAction<T>(action: () => Promise<T>, roles: string[] = []): { loading: boolean; data: T | null; error: Error | null; } {
  const { user } = useAppSession();
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {

        if (!user && roles.length > 0) {
          throw new Error('You must be logged in to perform this action.');
        }

        const hasRole = user.roleNames.some(role => roles.includes(role));

        if (!hasRole) {
          throw new Error('You do not have the required role to perform this action.');
        }

        const result = await action();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, action, roles]);

  return { loading, data, error };
}

export function RequireRoles({ children, roles }: { children: React.ReactNode, roles: string[] }) {
  const { user } = useAppSession();

  const hasRole = user?.roleNames.some(role => roles.includes(role));

  if (!hasRole) {
    return null;
  }

  return <>{children}</>;
}

