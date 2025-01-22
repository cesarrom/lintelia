export interface Auth0Config {
  domain: string;
  clientId: string;
  audience?: string;
}

export const auth0Config: Auth0Config = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '',
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '',
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
};

export const getTenantFromSubdomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  if (hostname === 'localhost') return null;
  
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  
  return null;
};

export const isSuperAdmin = (email: string): boolean => {
  return email.endsWith('@fintivio.org');
}; 