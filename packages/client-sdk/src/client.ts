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
  /** The Lintelia API, e.g. `https://api.lintelia.example` (or your institution's API address). */
  apiUrl: string;
  /** Your institution's key or host (sent as `X-Tenant`). */
  tenant: string;
  fetchClientSecret?: () => Promise<string>;
  fetchSubjectToken?: () => Promise<string>;
  /** Custom fetch (tests, React Native polyfills). */
  fetch?: typeof fetch;
}

export class LinteliaApiError extends Error {
  constructor(message: string, readonly status: number, readonly details?: unknown) {
    super(message);
  }
}

export interface LinteliaClient {
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
  /**
   * Listen to live topics (Server-Sent Events, docs/plans/17): `client/<your id>/records/*`, `.../notifications`,
   * `.../cases`, `.../messages`, `case/<id>`, `case/<id>/channel/<name>` (a journey's `live.topics`). `change` says
   * something changed (fetch it again); `message` carries what a workflow published. Reconnects by itself.
   */
  subscribe(topics: string[], onEvent: (event: LiveEvent) => void, options?: { replay?: boolean }): LiveSubscription;
}

export type LiveEvent =
  | { type: 'change'; topic: string }
  | { type: 'message'; topic: string; seq: number; payload: Record<string, unknown>; at?: string };

export interface LiveSubscription {
  close(): void;
  /** True while the stream is open. */
  readonly connected: boolean;
}

const MARGIN_MS = 60_000;

export function createClient(options: ClientOptions): LinteliaClient {
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
    if (!response.ok) throw new LinteliaApiError(parsed?.error ?? parsed?.message ?? `HTTP ${response.status}`, response.status, parsed?.errors);
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
      if (error instanceof LinteliaApiError && error.status === 401) {
        current = null;
        return call<T>(method, path, body, await token());
      }
      throw error;
    }
  };

  const subscribe = (topics: string[], onEvent: (event: LiveEvent) => void, subscribeOptions: { replay?: boolean } = {}): LiveSubscription => {
    let closed = false;
    let connected = false;
    let lastSeq = 0;
    let controller: AbortController | null = null;
    let delay = 1000;
    const seen = new Set<number>();
    const handle = (block: string) => {
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (!data.length) return;
      const parsed = JSON.parse(data.join('\n'));
      if (event === 'ready') { connected = true; delay = 1000; }
      if (event === 'change') onEvent({ type: 'change', topic: parsed.topic });
      if (event === 'message' && !seen.has(parsed.seq)) {
        seen.add(parsed.seq);
        lastSeq = Math.max(lastSeq, Number(parsed.seq));
        onEvent({ type: 'message', topic: parsed.topic, seq: Number(parsed.seq), payload: parsed.payload ?? {}, at: parsed.at });
      }
    };
    const open = async () => {
      while (!closed) {
        controller = new AbortController();
        try {
          const query = new URLSearchParams({ topics: topics.join(',') });
          if (subscribeOptions.replay && lastSeq === 0) query.set('replay', topics.join(','));
          if (lastSeq > 0) query.set('since', String(lastSeq));
          const response = await doFetch(`${api}/live?${query}`, {
            headers: { Accept: 'text/event-stream', 'X-Tenant': options.tenant, Authorization: `Bearer ${await token()}` },
            signal: controller.signal,
          });
          if (response.status === 401) current = null;
          if (!response.ok || !response.body) throw new LinteliaApiError(`HTTP ${response.status}`, response.status);
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index: number;
            while ((index = buffer.indexOf('\n\n')) >= 0) {
              handle(buffer.slice(0, index));
              buffer = buffer.slice(index + 2);
            }
          }
        } catch (error) {
          if (error instanceof LinteliaApiError && error.status === 403) closed = true;
        }
        connected = false;
        if (closed) break;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 15_000);
      }
    };
    void open();
    return {
      close: () => { closed = true; controller?.abort(); },
      get connected() { return connected; },
    };
  };

  return {
    signIn,
    subscribe,
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
