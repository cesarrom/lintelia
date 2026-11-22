import { env } from './env';
import type { Session } from './api';

/**
 * A live stream (docs/plans/17 §4.5: Server-Sent Events) read the way the web app reads it — `fetch` with the
 * `Authorization` header — or opened from a URL (ticket, capability address). Collects every event for assertions.
 */
export interface LiveEvent { event: string; data: any; id?: string }

export interface LiveStream {
  status: number;
  /** The refusal's body, when the stream did not open. */
  error: any;
  events: LiveEvent[];
  /** Raw text received (comments included: keep-alives). */
  raw: () => string;
  waitFor: (predicate: (e: LiveEvent) => boolean, timeoutMs?: number) => Promise<LiveEvent>;
  closed: () => boolean;
  close: () => void;
}

export async function openLiveUrl(url: string, headers: Record<string, string> = {}): Promise<LiveStream> {
  const controller = new AbortController();
  const response = await fetch(url, { headers: { Accept: 'text/event-stream', ...headers }, signal: controller.signal });
  const events: LiveEvent[] = [];
  let text = '';
  let ended = false;
  const listeners = new Set<() => void>();
  if (!response.ok || !response.body) {
    const error = await response.json().catch(() => null);
    return { status: response.status, error, events, raw: () => text, waitFor: async () => { throw new Error(`stream refused: ${response.status}`); }, closed: () => true, close: () => undefined };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        text += chunk;
        buffer += chunk;
        let index: number;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          let event = 'message';
          let id: string | undefined;
          const data: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith(':')) continue;
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
            else if (line.startsWith('id:')) id = line.slice(3).trim();
          }
          if (!data.length) continue;
          let parsed: unknown = data.join('\n');
          try {
            parsed = JSON.parse(parsed as string);
          } catch {
            // keep text
          }
          events.push({ event, data: parsed, id });
          for (const listener of listeners) listener();
        }
      }
    } catch {
      // aborted
    } finally {
      ended = true;
      for (const listener of listeners) listener();
    }
  })();
  const waitFor = (predicate: (e: LiveEvent) => boolean, timeoutMs = 15_000) => new Promise<LiveEvent>((resolve, reject) => {
    const check = () => {
      const found = events.find(predicate);
      if (found) {
        cleanup();
        resolve(found);
      } else if (ended) {
        cleanup();
        reject(new Error(`stream ended without the expected event; got: ${JSON.stringify(events).slice(0, 800)}`));
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`no expected live event within ${timeoutMs}ms; got: ${JSON.stringify(events).slice(0, 800)}`));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      listeners.delete(check);
    };
    listeners.add(check);
    check();
  });
  return { status: response.status, error: null, events, raw: () => text, waitFor, closed: () => ended, close: () => controller.abort() };
}

/** `GET /live?topics=…` as this session (or token). */
export function openLive(who: Session | string, tenant: string, topics: string[], options: { since?: number } = {}) {
  const token = typeof who === 'string' ? who : who.token;
  const query = new URLSearchParams({ topics: topics.join(',') });
  if (options.since !== undefined) query.set('since', String(options.since));
  return openLiveUrl(new URL(`/live?${query}`, env.apiUrl).toString(), { Authorization: `Bearer ${token}`, 'X-Tenant': tenant });
}

export const changeOf = (topic: string) => (e: LiveEvent) => e.event === 'change' && e.data?.topic === topic;
export const messageOn = (topic: string, predicate: (payload: any) => boolean = () => true) => (e: LiveEvent) => e.event === 'message' && e.data?.topic === topic && predicate(e.data.payload);
