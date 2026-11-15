import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { createFakeService, devPort, escapeHtml, page } from '@repo/fake-kit';

/**
 * Webhook receiver (docs/plans/04 §Fake services): every POST under `/hooks/*` is recorded with its headers and raw
 * body. Tests read them at `/__control/deliveries?path=`, make the next deliveries fail (`/__control/fail-next`),
 * make an endpoint answer a fixed status (`/__control/respond`, e.g. 410), and register a secret so the receiver
 * verifies Standard Webhooks signatures like a real consumer (`verified` on each delivery).
 */
interface Delivery {
  id: string;
  receivedAt: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  answeredWith: number;
  verified: boolean | null;
}

const service = createFakeService({ name: 'webhook-receiver', port: devPort('webhook-receiver', 9404), recordPaths: () => false });
const deliveries: Delivery[] = [];
const failNext = new Map<string, { count: number; status: number }>();
const fixed = new Map<string, number>();
const secrets = new Map<string, string>();
service.onReset(() => { deliveries.splice(0); failNext.clear(); fixed.clear(); secrets.clear(); });

function verify(secret: string, headers: Record<string, string>, body: string) {
  const id = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatures = (headers['webhook-signature'] ?? '').split(' ');
  if (!id || !timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.some((s) => {
    const [version, value] = s.split(',');
    if (version !== 'v1' || !value) return false;
    const given = Buffer.from(value, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const app = service.app;

app.post('/hooks/*', async (c) => {
  const path = c.req.path;
  const body = await c.req.text();
  const headers = Object.fromEntries(c.req.raw.headers.entries());
  let status = fixed.get(path) ?? 200;
  const failing = failNext.get(path);
  if (failing && failing.count > 0) {
    failing.count -= 1;
    status = failing.status;
  }
  const secret = secrets.get(path);
  deliveries.push({ id: randomUUID(), receivedAt: new Date().toISOString(), path, headers, body, answeredWith: status, verified: secret ? verify(secret, headers, body) : null });
  if (deliveries.length > 2000) deliveries.splice(0, deliveries.length - 2000);
  return c.json({ received: status < 300 }, status as 200);
});

app.get('/__control/deliveries', (c) => {
  const path = c.req.query('path');
  return c.json(path ? deliveries.filter((d) => d.path.startsWith(path)) : deliveries);
});

app.post('/__control/fail-next', async (c) => {
  const { path, count = 1, status = 500 } = await c.req.json<{ path: string; count?: number; status?: number }>();
  failNext.set(path, { count, status });
  return c.json({ path, count, status });
});

app.post('/__control/respond', async (c) => {
  const { path, status } = await c.req.json<{ path: string; status: number | null }>();
  if (status) fixed.set(path, status);
  else fixed.delete(path);
  return c.json({ path, status });
});

app.post('/__control/secrets', async (c) => {
  const { path, secret } = await c.req.json<{ path: string; secret: string }>();
  secrets.set(path, secret);
  return c.json({ path });
});

app.get('/', (c) => c.html(page('Webhook receiver', `
<p class="muted">POST anything to <code>/hooks/&lt;name&gt;</code>. Newest first.</p>
<table><tr><th>Received</th><th>Path</th><th>Type</th><th>Answer</th><th>Signature</th></tr>
${[...deliveries].reverse().slice(0, 200).map((d) => {
  let type = '';
  try { type = JSON.parse(d.body).type ?? ''; } catch { /* not JSON */ }
  return `<tr><td>${escapeHtml(d.receivedAt)}</td><td>${escapeHtml(d.path)}</td><td>${escapeHtml(type)}</td><td>${d.answeredWith}</td><td>${d.verified === null ? '—' : d.verified ? 'valid' : 'INVALID'}</td></tr>`;
}).join('')}
</table>`)));

service.start();
