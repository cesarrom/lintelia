import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@repo/fintivio/schemas';

/**
 * Sessions (docs/architecture/identity.md).
 *
 * Sign-in returns a short-lived access token (15 min), a rotating refresh token and the user (with effective
 * permissions). Both tokens are kept in localStorage; the access token is sent as `Authorization: Bearer` with
 * `X-Tenant` on every request. Before it expires (or after a 401) the refresh token is exchanged for a new pair; a
 * failed refresh ends the session. Sign-out revokes the session on the server.
 */

export const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;
const STORAGE_KEY = 'fintivio.session';
const REFRESH_MARGIN_MS = 60_000;

export interface PublicTenant {
  id: string;
  domain: string;
  name: string;
  logoUrl: string;
  pallette: { primary: string; secondary: string; accent: string };
}

export interface StoredSession {
  token: string;
  expiresAt: number;
  refreshToken?: string;
  user: User;
  tenant: PublicTenant | null;
}

/** A password sign-in that still needs the second factor (docs/plans/02). */
export type MfaChallenge = { mfaRequired: true; mfaToken: string } | { mfaEnrollmentRequired: true; enrollmentToken: string };
export type SignInResult = StoredSession | MfaChallenge;
export const isMfaChallenge = (result: SignInResult): result is MfaChallenge => 'mfaRequired' in result || 'mfaEnrollmentRequired' in result;

interface SessionContextValue {
  session: StoredSession | null;
  isLoading: boolean;
  setSession: (session: StoredSession | null) => void;
  refresh: () => Promise<StoredSession | null>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const readStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session.token) return null;
    // An expired access token is still useful while the refresh token is valid.
    if (session.expiresAt <= Date.now() && !session.refreshToken) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

export class AuthRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function authRequest<T>(path: string, body: unknown, tenant: string | null, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tenant ? { 'X-Tenant': tenant } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new AuthRequestError(data.error || data.message || 'Request failed', response.status);
  return data as T;
}

// One refresh at a time across hooks/interceptors (refresh tokens rotate: a second concurrent use would be reuse).
let refreshing: Promise<StoredSession | null> | null = null;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StoredSession | null>(() => readStoredSession());
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const setSession = useCallback((next: StoredSession | null) => {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const refresh = useCallback(async () => {
    const current = readStoredSession() ?? sessionRef.current;
    if (!current?.refreshToken) {
      setSession(null);
      return null;
    }
    if (!refreshing) {
      refreshing = authRequest<StoredSession>('/auth/refresh', { refreshToken: current.refreshToken }, current.tenant?.domain ?? null)
        .then((next) => {
          setSession(next);
          return next;
        })
        .catch(() => {
          // Another tab may have rotated the token already: adopt its session if it is newer.
          const stored = readStoredSession();
          if (stored && stored.refreshToken !== current.refreshToken && stored.expiresAt > Date.now()) {
            setSession(stored);
            return stored;
          }
          setSession(null);
          return null;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }, [setSession]);

  // Refresh shortly before the access token expires (immediately if it already has).
  useEffect(() => {
    if (!session) return;
    const delay = Math.max(0, session.expiresAt - Date.now() - REFRESH_MARGIN_MS);
    const timeout = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(timeout);
  }, [session, refresh]);

  // Follow sign-in/sign-out/refresh in other tabs.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const next = readStoredSession();
        sessionRef.current = next;
        setSessionState(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isLoading = !!session && session.expiresAt <= Date.now();
  const value = useMemo(() => ({ session, isLoading, setSession, refresh }), [session, isLoading, setSession, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const useSessionContext = () => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing');
  return context;
};

export const useSession = () => {
  const { session, isLoading, refresh } = useSessionContext();
  return {
    isAuthenticated: !!session,
    isSessionLoading: isLoading,
    sessionToken: session && session.expiresAt > Date.now() ? session.token : null,
    session,
    refresh,
  };
};

export const useUser = () => {
  const { session, isLoading } = useSessionContext();
  return { user: session?.user ?? null, isUserLoading: isLoading };
};

/** Sign-in (password or e-mailed code), registration, password reset and sign-out. `tenant`: key/host, null for staff. */
export const useAuthActions = () => {
  const { setSession, session } = useSessionContext();
  const token = session?.token;
  const tenantKey = session?.tenant?.domain ?? null;

  return useMemo(() => ({
    login: async (tenant: string | null, email: string, password: string) => {
      const next = await authRequest<SignInResult>('/auth/login', { email, password }, tenant);
      if (!isMfaChallenge(next)) setSession(next);
      return next;
    },
    /** Second factor: start enrolment (secret for the authenticator app), confirm it, or verify a code. */
    enrollTotp: (tenant: string | null, enrollmentToken: string) => authRequest<{ secret: string; otpauthUri: string }>('/auth/mfa/totp/enroll', { enrollmentToken }, tenant),
    confirmTotp: (tenant: string | null, enrollmentToken: string, code: string) =>
      authRequest<StoredSession & { recoveryCodes: string[] }>('/auth/mfa/totp/confirm', { enrollmentToken, code }, tenant),
    verifyMfa: async (tenant: string | null, mfaToken: string, code: string) => {
      const next = await authRequest<StoredSession>('/auth/mfa/verify', { mfaToken, code }, tenant);
      setSession(next);
      return next;
    },
    startOtp: (tenant: string, email: string) => authRequest<{ status: string }>('/auth/otp/start', { email }, tenant),
    verifyOtp: async (tenant: string, email: string, code: string) => {
      const next = await authRequest<StoredSession & { firstSeen?: boolean }>('/auth/otp/verify', { email, code }, tenant);
      setSession(next);
      return next;
    },
    register: async (tenant: string, input: { email: string; password: string; name?: string }) => {
      const next = await authRequest<StoredSession>('/auth/register', input, tenant);
      setSession(next);
      return next;
    },
    /** `tenant` null: a platform staff invitation (platform host). */
    acceptInvitation: async (tenant: string | null, input: { token: string; password: string; name?: string }) => {
      const next = await authRequest<SignInResult>('/auth/invitations/accept', input, tenant);
      if (!isMfaChallenge(next)) setSession(next);
      return next;
    },
    forgotPassword: (tenant: string | null, email: string) => authRequest('/auth/password/forgot', { email }, tenant),
    resetPassword: (token: string, password: string) => authRequest('/auth/password/reset', { token, password }, null),
    /** Adopt a session obtained elsewhere (e.g. confirming a form submission). */
    adopt: (next: StoredSession) => setSession(next),
    logout: async () => {
      if (token) await authRequest('/auth/logout', {}, tenantKey, token).catch(() => undefined);
      setSession(null);
    },
  }), [setSession, token, tenantKey]);
};

/** Public branding of a tenant, available before sign-in. */
export async function fetchPublicTenant(tenant: string): Promise<PublicTenant | null> {
  const response = await fetch(`${API_BASE_URL}/auth/tenant?domain=${encodeURIComponent(tenant)}`);
  if (!response.ok) return null;
  return response.json();
}

/**
 * Records the sign-in (or sign-up) event, which may trigger workflows, and returns where to go next
 * (`/app/dashboard` for members, `/portal` for clients, `/app/platform/institutions` for staff).
 */
export async function afterLogin(session: StoredSession, tenant: string | null, firstSeen: boolean): Promise<string> {
  const fallback = session.user.kind === 'client' ? '/portal' : session.tenant ? '/app/dashboard' : '/app/platform/institutions';
  try {
    const response = await fetch(`${API_BASE_URL}/auth/after-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
        ...(tenant ? { 'X-Tenant': tenant } : {}),
      },
      body: JSON.stringify({ firstSeen }),
    });
    const { redirectPath } = await response.json();
    return redirectPath || fallback;
  } catch {
    return fallback;
  }
}
