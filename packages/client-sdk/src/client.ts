/**
 * Headless client: your own screens over the client app's API (the same API the hosted app uses), signed in with a
 * client secret from your backend or a token of your identity provider. Tokens are kept in memory and refreshed.
 */

export interface ClientSession {
  token: string;
  expiresAt: number;
  refreshToken?: string;
  user: { userId: string; email: string; name?: string; kind: string };
}

export interface ClientOptions {
  /** The Fintivio API, e.g. `https://api.fintivio.com` (or your institution's API address). */
  apiUrl: string;
  /** Your institution's key or host (sent as `X-Tenant`). */
  tenant: string;
  fetchClientSecret?: () => Promise<string>;
  fetchSubjectToken?: () => Promise<string>;
  /** Custom fetch (tests, React Native polyfills). */
  fetch?: typeof fetch;
}

export class FintivioApiError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

export interface FintivioClient {
  signIn(): Promise<ClientSession>;
  session(): ClientSession | null;
  signOut(): Promise<void>;
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
  app<T = unknown>(): Promise<T>;
  data<T = Record<string, unknown>>(sources: string[]): Promise<T>;
  startJourney<T = unknown>(journey: string, input?: Record<string, unknown>): Promise<T>;
  journey<T = unknown>(caseId: string): Promise<T>;
  submitScreen<T = unknown>(caseId: string, taskId: string, event: string, values?: Record<string, unknown>): Promise<T>;
  updateProfile<T = unknown>(fields: Record<string, unknown>): Promise<T>;
  markNotificationsRead(id?: string): Promise<void>;
}

const MARGIN_MS = 60_000;

export function createClient(options: ClientOptions): FintivioClient {
  const api = options.apiUrl.replace(/\/+$/, '');
  const doFetch = options.fetch ?? fetch;
  let current: ClientSession | null = null;
  let pending: Promise<ClientSession> | null = null;

  const call = async <T>(method: string, path: string, body: unknown, token?: string): Promise<T> => {
    const response = await doFetch(`${api}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Tenant': options.tenant, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new FintivioApiError(parsed?.error ?? parsed?.message ?? `HTTP ${response.status}`, response.status, parsed?.errors);
    return parsed as T;
  };

  const signIn = () => {
    pending ??= (async () => {
      try {
        if (options.fetchClientSecret) current = await call<ClientSession>('POST', '/auth/client/session', { clientSecret: await options.fetchClientSecret() });
        else if (options.fetchSubjectToken) current = await call<ClientSession>('POST', '/auth/client/token', { subjectToken: await options.fetchSubjectToken() });
        else throw new Error('fetchClientSecret or fetchSubjectToken is required');
        return current!;
      } finally {
        pending = null;
      }
    })();
    return pending;
  };

  const token = async () => {
    if (current && current.expiresAt - MARGIN_MS > Date.now()) return current.token;
    if (current?.refreshToken) {
      try {
        current = await call<ClientSession>('POST', '/auth/refresh', { refreshToken: current.refreshToken });
        return current.token;
      } catch {
        current = null;
      }
    }
    return (await signIn()).token;
  };

  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    try {
      return await call<T>(method, path, body, await token());
    } catch (error) {
      // A revoked session: sign in again once.
      if (error instanceof FintivioApiError && error.status === 401) {
        current = null;
        return call<T>(method, path, body, await token());
      }
      throw error;
    }
  };

  return {
    signIn,
    session: () => current,
    signOut: async () => {
      if (current) await call('POST', '/auth/logout', {}, current.token).catch(() => undefined);
      current = null;
    },
    request,
    app: () => request('GET', '/me/app'),
    data: (sources) => request('POST', '/me/app/data', { sources }),
    startJourney: (journey, input = {}) => request('POST', `/me/app/journeys/${encodeURIComponent(journey)}/start`, { input }),
    journey: (caseId) => request('GET', `/me/app/cases/${encodeURIComponent(caseId)}/journey`),
    submitScreen: (caseId, taskId, event, values = {}) => request('POST', `/me/app/cases/${encodeURIComponent(caseId)}/screens/${encodeURIComponent(taskId)}`, { event, values }),
    updateProfile: (fields) => request('PATCH', '/me/app/profile', { fields }),
    markNotificationsRead: async (id) => { await request('POST', id ? `/me/app/notifications/${encodeURIComponent(id)}/read` : '/me/app/notifications/read', {}); },
  };
}
