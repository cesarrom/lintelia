import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useTenantGetTenant } from "../services/tenant.hooks";
import { Tenant } from '@repo/lintelia/schemas';
// eslint-disable-next-line @typescript-eslint()
import Cookies from 'js-cookie'

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  error: Error | null;
  domain: string; // The domain being used (either from cookie or hostname)
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_COOKIE = 'lintelia-domain';
/** Hosts that serve the platform (staff) app rather than a tenant, e.g. `localhost:3001`. */
const ROOT_HOSTS = ((import.meta.env.VITE_ROOT_HOSTS as string | undefined) ?? 'localhost:3001,127.0.0.1:3001')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

/**
 * The tenant this browser tab works with: an explicit `?tenant=` (e.g. from an invitation link, remembered in a
 * cookie), otherwise the host name (`demo-bank.localhost:3001`, `onboarding.bank.com`). Empty on the platform host.
 */
export const resolveDomain = (): string => {
  const fromQuery = new URLSearchParams(window.location.search).get('tenant');
  if (fromQuery) {
    Cookies.set(TENANT_COOKIE, fromQuery, { sameSite: 'lax' });
    return fromQuery;
  }
  const cookie = Cookies.get(TENANT_COOKIE);
  if (cookie) return cookie;
  const host = window.location.host.toLowerCase();
  return ROOT_HOSTS.includes(host) ? '' : host;
};

/** Forget an explicit tenant selection (back to host-based resolution). */
export const clearTenantOverride = () => Cookies.remove(TENANT_COOKIE);

export const useDomain = () => {
  const [domain] = useState<string>(resolveDomain);
  return domain;
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
