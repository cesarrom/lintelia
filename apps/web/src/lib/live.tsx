import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { API_BASE_URL, useSession } from './auth/session';

/**
 * Live updates (docs/plans/17 §4): one Server-Sent Events stream per tab (`GET /live`, read with `fetch` so the
 * access token travels in the `Authorization` header), carrying the topics every mounted screen asked for. Changes are
 * thin — the screen fetches its data again through the normal endpoints — and messages (what workflows publish) come
 * in order, replayed to screens that start listening late. While the stream is down, screens fall back to polling.
 */
export interface LiveChange { kind: 'change'; topic: string }
export interface LiveMessageEvent { kind: 'message'; topic: string; seq: number; payload: Record<string, any>; at?: string }
export type LiveEvent = LiveChange | LiveMessageEvent;
export type LiveStatus = 'off' | 'connecting' | 'connected' | 'disconnected';

interface Subscription { topics: string[]; replay: boolean; listener: (event: LiveEvent) => void }

export const covers = (subscription: string, topic: string) =>
  subscription === topic || (subscription.endsWith('/*') && topic.startsWith(subscription.slice(0, -1)) && !topic.slice(subscription.length - 1).includes('/'));

class LiveClient {
  private subscriptions = new Map<number, Subscription>();
  private nextId = 0;
  private abort: AbortController | null = null;
  private connectedTopics = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private lastSeq = 0;
  private seen = new Set<number>();
  private pendingReplay = false;
  /** Recent messages per topic: a screen that starts listening again gets them at once. */
  private cache = new Map<string, LiveMessageEvent[]>();
  private statusListeners = new Set<() => void>();
  status: LiveStatus = 'off';
  credentials: { token: string; tenant: string | null } | null = null;
  onExpired: (() => void) | null = null;

  setCredentials(credentials: { token: string; tenant: string | null } | null) {
    const changed = credentials?.token !== this.credentials?.token || credentials?.tenant !== this.credentials?.tenant;
    this.credentials = credentials;
    if (changed) this.schedule(true);
  }

  subscribe(topics: string[], listener: (event: LiveEvent) => void, replay = false) {
    const id = ++this.nextId;
    this.subscriptions.set(id, { topics, replay, listener });
    if (replay) {
      this.pendingReplay = true;
      const cached = [...this.cache.entries()].filter(([topic]) => topics.some((t) => covers(t, topic))).flatMap(([, list]) => list).sort((a, b) => a.seq - b.seq);
      if (cached.length) queueMicrotask(() => { if (this.subscriptions.has(id)) for (const message of cached) listener(message); });
    }
    this.schedule();
    return () => {
      this.subscriptions.delete(id);
      this.schedule();
    };
  }

  onStatus(listener: () => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: LiveStatus) {
    if (this.status === status) return;
    this.status = status;
    if (typeof document !== 'undefined') document.documentElement.dataset.live = status;
    for (const listener of this.statusListeners) listener();
  }

  private topics() {
    return [...new Set([...this.subscriptions.values()].flatMap((s) => s.topics))].sort();
  }

  /** Reconnect when the topics change (batched), or at once when forced (new credentials). */
  private schedule(force = false) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const topics = this.topics();
      const key = topics.join(',');
      if (!force && key === this.connectedTopics && !this.pendingReplay && this.status !== 'disconnected') return;
      this.connect(topics);
    }, force ? 0 : 60);
  }

  private connect(topics: string[]) {
    this.abort?.abort();
    this.abort = null;
    this.connectedTopics = topics.join(',');
    if (!topics.length || !this.credentials) {
      this.setStatus('off');
      return;
    }
    const controller = new AbortController();
    this.abort = controller;
    this.pendingReplay = false;
    const query = new URLSearchParams({ topics: topics.join(',') });
    // Screens that want what was published before they listened get it from the start; the others only what came
    // after the last message this tab received.
    const replay = [...new Set([...this.subscriptions.values()].filter((s) => s.replay).flatMap((s) => s.topics))];
    if (replay.length) query.set('replay', replay.join(','));
    if (this.lastSeq > 0) query.set('since', String(this.lastSeq));
    this.setStatus('connecting');
    void (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/live?${query}`, {
          headers: { Authorization: `Bearer ${this.credentials!.token}`, ...(this.credentials!.tenant ? { 'X-Tenant': this.credentials!.tenant } : {}), Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (response.status === 401) {
          this.onExpired?.();
          throw new Error('unauthorized');
        }
        if (!response.ok || !response.body) throw new Error(`live ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            this.handle(block);
          }
        }
        throw new Error('stream ended');
      } catch {
        if (controller.signal.aborted) return;
        this.setStatus('disconnected');
        this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(this.topics()); }, this.backoff);
        this.backoff = Math.min(this.backoff * 2, 15_000);
      }
    })();
  }

  private handle(block: string) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return;
    let parsed: any;
    try {
      parsed = JSON.parse(data.join('\n'));
    } catch {
      return;
    }
    if (event === 'ready') {
      this.backoff = 1000;
      this.setStatus('connected');
    } else if (event === 'expired' || event === 'revoked') {
      if (event === 'expired') this.onExpired?.();
    } else if (event === 'change' && typeof parsed?.topic === 'string') {
      this.dispatch({ kind: 'change', topic: parsed.topic });
    } else if (event === 'message' && typeof parsed?.topic === 'string') {
      const seq = Number(parsed.seq);
      if (this.seen.has(seq)) return;
      this.seen.add(seq);
      if (this.seen.size > 2000) this.seen = new Set([...this.seen].slice(-1000));
      this.lastSeq = Math.max(this.lastSeq, seq);
      const message: LiveMessageEvent = { kind: 'message', topic: parsed.topic, seq, payload: parsed.payload ?? {}, at: parsed.at };
      const list = this.cache.get(message.topic) ?? [];
      this.cache.set(message.topic, [...list, message].slice(-50));
      this.dispatch(message);
    }
  }

  private dispatch(event: LiveEvent) {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.topics.some((t) => covers(t, event.topic))) {
        try {
          subscription.listener(event);
        } catch (error) {
          console.error('live listener failed', error);
        }
      }
    }
  }
}

const LiveContext = createContext<LiveClient | null>(null);

/** One live client per tab, following the session (a refreshed token reconnects it). */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { session, refresh } = useSession();
  const client = useMemo(() => new LiveClient(), []);
  client.onExpired = () => void refresh();
  useEffect(() => {
    client.setCredentials(session?.token && session.expiresAt > Date.now() ? { token: session.token, tenant: session.tenant?.domain ?? null } : null);
  }, [client, session?.token, session?.expiresAt, session?.tenant?.domain]);
  return <LiveContext.Provider value={client}>{children}</LiveContext.Provider>;
}

export function useLiveStatus(): LiveStatus {
  const client = useContext(LiveContext);
  return useSyncExternalStore((listener) => client?.onStatus(listener) ?? (() => undefined), () => client?.status ?? 'off', () => 'off');
}

/** Polling while the stream is down; a slow safety net while it is up. */
export function usePollInterval(ms: number, whileLive = 60_000) {
  return useLiveStatus() === 'connected' ? Math.max(ms, whileLive) : ms;
}

/** Listen to topics while mounted (`replay`: also what was published before, for message topics). */
export function useLive(topics: Array<string | null | undefined | false>, onEvent: (event: LiveEvent) => void, options: { replay?: boolean } = {}) {
  const client = useContext(LiveContext);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const list = topics.filter((t): t is string => !!t);
  const key = list.join(',');
  useEffect(() => {
    if (!client || !key) return;
    return client.subscribe(key.split(','), (event) => handler.current(event), options.replay);
  }, [client, key, options.replay]);
}

/** Fetch these queries again when any of the topics changes (batched: one refetch per burst of changes). */
export function useLiveInvalidate(topics: Array<string | null | undefined | false>, queryKeys: QueryKey[], delay = 150) {
  const queryClient = useQueryClient();
  const keys = useRef(queryKeys);
  keys.current = queryKeys;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useLive(topics, (event) => {
    if (event.kind !== 'change') return;
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      for (const queryKey of keys.current) void queryClient.invalidateQueries({ queryKey });
    }, delay);
  });
}
