import { type GetTenant } from '@/actions/tenants/getTenant';
import React, { createContext, useContext } from 'react';

interface Session {
  tenant: GetTenant | null
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  isAuthenticated: boolean;
}

interface SessionContextType {
  session: Session;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider: React.FC<React.PropsWithChildren<{ session: Session }>> = ({ children, session }) => {

  return (
    <SessionContext.Provider value={{ session }}>
      {children}
    </SessionContext.Provider>
  );
};

