import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useTenantGetTenant } from "../services/tenant.hooks";
import { Tenant } from '@repo/fintivio/schemas';
// eslint-disable-next-line @typescript-eslint()
import Cookies from 'js-cookie'

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  error: Error | null;
  domain: string; // The domain being used (either from cookie or hostname)
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useDomain = () => {
  const [domainToUse, setDomainToUse] = useState<string>('');
  const cookie = Cookies.get('fintivio-domain');
  const hostname = window.location.host;
  useEffect(() => {
    const to = setTimeout(() => {
      setDomainToUse(cookie || hostname);
    }, 500);
    return () => clearTimeout(to);
  }, [cookie, hostname]);

  return domainToUse;
}

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const domainToUse = useDomain();

  const { data: tenant, isLoading, error } = useTenantGetTenant(
    { domain: domainToUse },
    { enabled: !!domainToUse } // Only run query if domainToUse is available
  );


  const value = {
    tenant: tenant || null,
    isLoading,
    error,
    domain: domainToUse
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
