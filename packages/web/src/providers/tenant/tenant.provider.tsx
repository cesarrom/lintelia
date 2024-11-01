"use client"
import React, { createContext, useContext } from 'react';
import { GetTenant } from '@/actions/tenants';

interface TenantContextType {
  tenant: GetTenant;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export const TenantProvider: React.FC<React.PropsWithChildren<Omit<TenantContextType, 'setSession'>>> = ({ children, tenant }) => {
  return (
    <TenantContext.Provider value={{ tenant }}>
      {children}
    </TenantContext.Provider>
  );
};

