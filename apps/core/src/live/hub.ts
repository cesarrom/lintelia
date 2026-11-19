import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, asc, eq, gt, inArray, like, lt, or, sql } from 'drizzle-orm';
import { liveMessages } from '../entities';
import { DATABASES } from '../injector/tokens/databases.token';
import type { Databases, TenantDatabase } from '../clients/database.client';
import { env } from '../constants';
import { covers, isMessageTopic } from './topics';

/**
 * Live updates (docs/plans/17 §4): Server-Sent Events to the screens. Postgres tells every API instance, after commit,
 * which topics changed (`NOTIFY fintivio_live` from triggers on records, notifications, profiles, cases, tasks and
 * live messages); each instance forwards to the streams it holds. Changes are thin ("topic X changed": the screen
 * fetches again through the authorised endpoint); messages (`live.publish`) are kept in `live_messages`, ordered, and
 * replayed to late listeners (`since`). Streams send a keep-alive comment, end when the access token expires (the
 * browser reconnects with a fresh one) and as soon as the session is revoked.
 *
 * The bus is Postgres here; a managed hub (or Redis) can replace `LiveHub` behind the same endpoint later.
 */
export interface LiveMessage { topic: string; seq: number; payload: Record<string, unknown>; at?: string }

interface Stream {
  id: number;
  tenantId: string;
  owner: string;
  topics: string[];
  controller: ReadableStreamDefaultController<Uint8Array>;
  closed: boolean;
  pending: Set<string>;
  flush: ReturnType<typeof setTimeout> | null;
  closeAt: number | null;
  revalidate?: () => Promise<boolean>;
  checkedAt: number;
  replaying: boolean;
  buffered: LiveMessage[];
  lastSeq: number;
  /** Messages already sent (commit order may differ from sequence order: no dropping by comparison). */
  sent: Set<number>;
}

export interface OpenOptions {
  tenantId: string;
  /** Who holds the stream (limits per person). */
  owner: string;
  topics: string[];
  /** Replay messages of message topics after this sequence number (0: all kept). */
  since?: number | null;
  /** Topics to replay from the start whatever `since` says (screens that just began listening to them). */
  replay?: string[];
  /** When the credentials expire (ms): the stream ends then. */
  closeAt?: number | null;
  /** Is the session still valid? Checked every LIVE_REVALIDATE_MS. */
  revalidate?: () => Promise<boolean>;
}

const encoder = new TextEncoder();
const RETENTION_DAYS = 7;
const COALESCE_MS = 120;

export class TooManyStreamsError extends Error {
  status = 429;
}

@Injectable()
export class LiveHub implements OnModuleInit, OnModuleDestroy {
  private streams = new Map<string, Set<Stream>>();
  private waiters = new Map<string, Set<() => void>>();
  private sequence = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retention: ReturnType<typeof setInterval> | null = null;
  private unlisten: (() => Promise<void>) | null = null;

  constructor(@Inject(DATABASES) private readonly databases: Databases) { }

  async onModuleInit() {
    const subscription = await this.databases.listen('fintivio_live', (payload) => this.dispatch(payload));
    this.unlisten = () => subscription.unlisten();
    this.heartbeat = setInterval(() => this.tick(), Math.min(env.LIVE_HEARTBEAT_MS, env.LIVE_REVALIDATE_MS, 5000));
    this.retention = setInterval(() => void this.prune().catch((error) => console.error('live retention failed', (error as Error).message)), 3600_000);
  }

  async onModuleDestroy() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.retention) clearInterval(this.retention);
    for (const set of this.streams.values()) for (const stream of set) this.close(stream);
    await this.unlisten?.().catch(() => undefined);
  }

  private db(tenantId: string): TenantDatabase {
    return this.databases.forTenant(tenantId);
  }

  // --- streams ---------------------------------------------------------------------------------------------------------

  /** Open a stream (the `text/event-stream` response). */
  open(options: OpenOptions): Response {
    const owned = [...(this.streams.get(options.tenantId) ?? [])].filter((s) => s.owner === options.owner).length;
    if (owned >= env.LIVE_MAX_STREAMS_PER_USER) throw new TooManyStreamsError(`At most ${env.LIVE_MAX_STREAMS_PER_USER} live connections at once`);
    let stream!: Stream;
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        stream = {
          id: ++this.sequence, tenantId: options.tenantId, owner: options.owner, topics: options.topics, controller, closed: false,
          pending: new Set(), flush: null, closeAt: options.closeAt ?? null, revalidate: options.revalidate, checkedAt: Date.now(),
          replaying: (options.since !== null && options.since !== undefined) || !!options.replay?.length, buffered: [], lastSeq: 0, sent: new Set(),
        };
        let set = this.streams.get(options.tenantId);
        if (!set) this.streams.set(options.tenantId, (set = new Set()));
        set.add(stream);
        this.write(stream, `retry: 3000\nevent: ready\ndata: ${JSON.stringify({ topics: options.topics })}\n\n`);
        if (stream.replaying) void this.replay(stream, options.since ?? null, options.replay ?? []);
      },
      cancel: () => this.remove(stream),
    });
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
    });
  }

  /** Streams currently open (for the load numbers and tests). */
  count() {
    let total = 0;
    for (const set of this.streams.values()) total += set.size;
    return total;
  }

  private write(stream: Stream, text: string) {
    if (stream.closed) return;
    try {
      stream.controller.enqueue(encoder.encode(text));
    } catch {
      this.remove(stream);
    }
  }

  private remove(stream: Stream | undefined) {
    if (!stream || stream.closed) return;
    stream.closed = true;
    if (stream.flush) clearTimeout(stream.flush);
    this.streams.get(stream.tenantId)?.delete(stream);
  }

  private close(stream: Stream, event?: string) {
    if (event) this.write(stream, `event: ${event}\ndata: {}\n\n`);
    try {
      stream.controller.close();
    } catch {
      // already closed
    }
    this.remove(stream);
  }

  private sendMessage(stream: Stream, message: LiveMessage) {
    if (stream.sent.has(message.seq)) return;
    stream.sent.add(message.seq);
    if (stream.sent.size > 5000) stream.sent = new Set([...stream.sent].slice(-2500));
    stream.lastSeq = Math.max(stream.lastSeq, message.seq);
    this.write(stream, `id: ${message.seq}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`);
  }

  private async replay(stream: Stream, since: number | null, fromStart: string[]) {
    try {
      const topics = stream.topics.filter(isMessageTopic);
      const first = fromStart.filter((t) => isMessageTopic(t) && topics.includes(t));
      const query = async (list: string[], after: number) => {
        if (!list.length) return [];
        const exact = list.filter((t) => !t.endsWith('/*'));
        const prefixes = list.filter((t) => t.endsWith('/*')).map((t) => `${t.slice(0, -1).replace(/[%_\\]/g, '\\$&')}%`);
        return this.db(stream.tenantId).select().from(liveMessages)
          .where(and(gt(liveMessages.seq, after), or(exact.length ? inArray(liveMessages.topic, exact) : undefined, ...prefixes.map((p) => like(liveMessages.topic, p)))))
          .orderBy(asc(liveMessages.seq)).limit(1000);
      };
      const rows = [...(since !== null ? await query(topics, since) : []), ...await query(first, 0)];
      const seen = new Set<number>();
      for (const row of rows.sort((a, b) => a.seq - b.seq)) {
        if (seen.has(row.seq) || !stream.topics.some((t) => covers(t, row.topic))) continue;
        seen.add(row.seq);
        this.sendMessage(stream, { topic: row.topic, seq: row.seq, payload: row.payload, at: row.createdAt.toISOString() });
      }
    } catch (error) {
      console.error('live replay failed', (error as Error).message);
    } finally {
      stream.replaying = false;
      for (const message of stream.buffered.sort((a, b) => a.seq - b.seq)) this.sendMessage(stream, message);
      stream.buffered = [];
    }
  }

  // --- what Postgres tells us ------------------------------------------------------------------------------------------

  private dispatch(raw: string) {
    let note: { t?: string; topics?: string[]; seq?: number; payload?: Record<string, unknown> | null };
    try {
      note = JSON.parse(raw);
    } catch {
      return;
    }
    if (!note.t || !Array.isArray(note.topics)) return;
    for (const topic of note.topics) this.wake(note.t, topic);
    const set = this.streams.get(note.t);
    if (!set?.size) return;
    if (note.seq !== undefined && note.seq !== null) {
      const topic = note.topics[0];
      const listeners = [...set].filter((s) => s.topics.some((t) => covers(t, topic)));
      if (!listeners.length) return;
      const deliver = (payload: Record<string, unknown>) => {
        const message = { topic, seq: Number(note.seq), payload, at: new Date().toISOString() };
        for (const stream of listeners) {
          if (stream.replaying) stream.buffered.push(message);
          else this.sendMessage(stream, message);
        }
      };
      if (note.payload) deliver(note.payload);
      else void this.db(note.t).select({ payload: liveMessages.payload }).from(liveMessages).where(eq(liveMessages.seq, Number(note.seq))).limit(1)
        .then(([row]) => row && deliver(row.payload)).catch(() => undefined);
      return;
    }
    for (const stream of set) {
      for (const topic of note.topics) {
        if (!stream.topics.some((t) => covers(t, topic))) continue;
        stream.pending.add(topic);
        stream.flush ??= setTimeout(() => {
          stream.flush = null;
          const topics = [...stream.pending];
          stream.pending.clear();
          for (const changed of topics) this.write(stream, `event: change\ndata: ${JSON.stringify({ topic: changed })}\n\n`);
        }, COALESCE_MS);
      }
    }
  }

  private tick() {
    const now = Date.now();
    for (const set of this.streams.values()) {
      for (const stream of [...set]) {
        if (stream.closeAt !== null && now >= stream.closeAt) {
          this.close(stream, 'expired');
          continue;
        }
        if (stream.revalidate && now - stream.checkedAt >= env.LIVE_REVALIDATE_MS) {
          stream.checkedAt = now;
          void stream.revalidate().then((valid) => { if (!valid) this.close(stream, 'revoked'); }).catch(() => undefined);
        }
      }
    }
    // Keep-alive: a comment line (proxies and the server close idle connections).
    if (now - this.pingedAt >= env.LIVE_HEARTBEAT_MS) {
      this.pingedAt = now;
      for (const set of this.streams.values()) for (const stream of set) this.write(stream, `: ping ${now}\n\n`);
    }
  }

  private pingedAt = Date.now();

  // --- for the server itself ---------------------------------------------------------------------------------------------

  private wake(tenantId: string, topic: string) {
    const key = `${tenantId}|${topic}`;
    const waiters = this.waiters.get(key);
    if (!waiters) return;
    this.waiters.delete(key);
    for (const wake of waiters) wake();
  }

  /** Resolves when the topic changes, or after `timeoutMs` (e.g. a journey waiting for its next screen). */
  next(tenantId: string, topic: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const key = `${tenantId}|${topic}`;
      let set = this.waiters.get(key);
      if (!set) this.waiters.set(key, (set = new Set()));
      const wake = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.waiters.get(key)?.delete(wake);
        resolve(false);
      }, timeoutMs);
      set.add(wake);
    });
  }

  /** Publish a message on a topic (kept and replayed): the trigger tells every instance. */
  async publish(tenantId: string, topic: string, payload: Record<string, unknown>) {
    const [row] = await this.db(tenantId).insert(liveMessages).values({ topic, payload }).returning({ seq: liveMessages.seq });
    return row.seq;
  }

  async prune() {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    const rows = await this.databases.platform.execute(sql`select id from tenants`);
    for (const { id } of rows as unknown as Array<{ id: string }>) await this.db(id).delete(liveMessages).where(lt(liveMessages.createdAt, cutoff));
  }
}

/** Write a live message from anywhere holding a tenant database (the engine). */
export async function publishLiveMessage(db: TenantDatabase, topic: string, payload: Record<string, unknown>) {
  const [row] = await db.insert(liveMessages).values({ topic, payload }).returning({ seq: liveMessages.seq });
  return row.seq;
}
