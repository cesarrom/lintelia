"use client"
import { AppSession } from '@/actions/session/getSession';
import React, { createContext, useContext } from 'react';

interface SessionContextType {
  session: AppSession;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const SessionProvider: React.FC<React.PropsWithChildren<SessionContextType>> = ({ children, session }) => {
  return (
    <SessionContext.Provider value={{ session }}>
      {children}
    </SessionContext.Provider>
  );
};

