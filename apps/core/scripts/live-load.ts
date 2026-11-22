/**
 * Spike S5 of docs/plans/17: how many live streams one API process holds, and what fan-out costs.
 *
 *   bun run live:load [streams=1000] [messages=500] [rate=100]
 *
 * Runs a LiveHub in this process against the local database (the same Postgres NOTIFY path as the API), opens
 * `streams` streams on one case channel of Demo Bank, publishes `messages` messages at `rate` per second, and reports
 * memory per stream and delivery latency (publish → every stream). HTTP itself is not included (Bun streams the same
 * ReadableStream to the socket).
 */
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createDatabases } from '../src/clients/database.client';
import { env } from '../src/constants';
import { LiveHub } from '../src/live/hub';
import { liveMessages } from '../src/entities';

const [streams = 1000, messages = 500, rate = 100] = process.argv.slice(2).map(Number);
const databases = createDatabases({ app: env.DATABASE_URL, platform: env.DATABASE_PLATFORM_URL });
const [tenant] = (await databases.platform.execute(sql`select id from tenants where domain = 'demo-bank'`)) as unknown as Array<{ id: string }>;
if (!tenant) throw new Error('Demo Bank not found: run the seed');
(env as { LIVE_MAX_STREAMS_PER_USER: number }).LIVE_MAX_STREAMS_PER_USER = streams + 1;
const hub = new LiveHub(databases);
await hub.onModuleInit();

const topic = `case/${randomUUID()}/channel/load`;
const latencies: number[] = [];
let received = 0;
const gc = () => (globalThis as { Bun?: { gc(force: boolean): void } }).Bun?.gc(true);
gc();
const before = process.memoryUsage();
const readers: Array<ReadableStreamDefaultReader<Uint8Array>> = [];
for (let i = 0; i < streams; i++) {
  const response = hub.open({ tenantId: tenant.id, owner: `load-${i % 50}`, topics: [topic] });
  const reader = response.body!.getReader();
  readers.push(reader);
  const decoder = new TextDecoder();
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true as const }));
      if (done) break;
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: {"topic"')) continue;
        const sent = JSON.parse(line.slice(6)).payload?.sentAt;
        if (sent) {
          latencies.push(performance.now() - sent);
          received++;
        }
      }
    }
  })();
}
await Bun.sleep(500);
gc();
const opened = process.memoryUsage();
console.log(`${streams} streams open: +${((opened.rss - before.rss) / 1024 / 1024).toFixed(1)} MB RSS, +${((opened.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(1)} MB heap (≈ ${(((opened.rss - before.rss) / streams) / 1024).toFixed(1)} kB per stream)`);

const cpu = process.cpuUsage();
const started = performance.now();
for (let i = 0; i < messages; i++) {
  void hub.publish(tenant.id, topic, { n: i, sentAt: performance.now() });
  await Bun.sleep(1000 / rate);
}
const deadline = Date.now() + 15_000;
while (received < streams * messages && Date.now() < deadline) await Bun.sleep(100);
const elapsed = (performance.now() - started) / 1000;
const used = process.cpuUsage(cpu);
latencies.sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))]?.toFixed(1);
console.log(`${messages} messages at ${rate}/s to ${streams} streams: ${received} of ${streams * messages} delivered in ${elapsed.toFixed(1)} s`);
console.log(`latency publish → stream: p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, p99 ${pct(0.99)} ms`);
console.log(`CPU: ${((used.user + used.system) / 1000 / elapsed / 10).toFixed(0)}% of one core (${((used.user + used.system) / 1000 / received * 1000).toFixed(1)} µs per delivery)`);

for (const reader of readers) await reader.cancel().catch(() => undefined);
await databases.forTenant(tenant.id).delete(liveMessages).where(sql`${liveMessages.topic} = ${topic}`);
await hub.onModuleDestroy();
await databases.close();
process.exit(0);
