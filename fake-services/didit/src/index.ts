import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createFakeService, devPort, escapeHtml, jsonState } from '@repo/fake-kit';

/**
 * Didit (docs/plans/05), as far as we know its API — every assumption is listed in
 * integrations/didit/docs/ASSUMPTIONS.md:
 *  - `POST /v2/session/` (header `x-api-key`) creates a verification session → `{ session_id, url, … }`
 *  - `GET /v2/session/{id}/decision/` returns the decision
 *  - `GET /v2/workflows/` lists workflows (used by "Test connection" and the workflow picker)
 *  - webhooks: POST JSON to the URL configured in the Didit console, `X-Signature` = hex HMAC-SHA256 of the raw body
 *    with the webhook secret, `X-Timestamp` = unix seconds
 * The hosted page `/session/<token>` speaks the web SDK's postMessage protocol (`didit:ready`, `didit:started`,
 * `didit:completed`) and has buttons for every outcome, for people and Playwright alike.
 *
 * Control API: `/__control/decisions` presets the outcome per applicant e-mail (Approved / Declined / In Review complete
 * automatically; Abandoned never completes), `/__control/webhooks` registers a webhook URL + secret for an API key (what
 * an admin does in the Didit console), `/__control/sessions`, `/__control/sessions/:id/complete`,
 * `/__control/webhook-mode` (normal | duplicate | bad-signature).
 */
type Status = 'Not Started' | 'In Progress' | 'Approved' | 'Declined' | 'In Review' | 'Abandoned' | 'Expired';

interface Session {
  session_id: string;
  session_number: number;
  session_token: string;
  api_key: string;
  workflow_id: string;
  vendor_data: string | null;
  callback: string | null;
  email: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

const port = devPort('didit', 9401);
const base = process.env.DIDIT_FAKE_PUBLIC_URL ?? `http://localhost:${port}`;
const service = createFakeService({ name: 'didit', port, recordPaths: (p) => p.startsWith('/v2/') });
const state = jsonState<{ sessions: Session[]; webhooks: Record<string, { url: string; secret: string }>; decisions: Record<string, { decision: Status; delayMs: number }> }>(
  'didit', 'state.json', { sessions: [], webhooks: {}, decisions: {} },
);
let webhookMode: 'normal' | 'duplicate' | 'bad-signature' = 'normal';
const webhookLog: Array<{ at: string; url: string; status: number | null; body: string }> = [];
service.onReset(() => { state.set({ sessions: [], webhooks: {}, decisions: {} }); webhookMode = 'normal'; webhookLog.splice(0); });

const WORKFLOWS = [
  { workflow_id: 'kyc-standard', workflow_label: 'KYC: ID document + liveness' },
  { workflow_id: 'kyc-aml', workflow_label: 'KYC: ID document + liveness + AML screening' },
];

const save = (session: Session) => {
  const current = state.get();
  state.set({ ...current, sessions: [...current.sessions.filter((s) => s.session_id !== session.session_id), session] });
};
const find = (predicate: (s: Session) => boolean) => state.get().sessions.find(predicate);
const apiKeyOf = (c: { req: { header(name: string): string | undefined } }) => c.req.header('x-api-key') ?? '';
const authorised = (key: string) => key.length > 0 && key !== 'invalid';

function decision(session: Session) {
  const final = ['Approved', 'Declined', 'In Review'].includes(session.status);
  const check = (status: string) => (final ? status : 'Not Finished');
  const verdict = session.status === 'Approved' ? 'Approved' : session.status === 'Declined' ? 'Declined' : 'In Review';
  return {
    session_id: session.session_id, session_number: session.session_number, status: session.status, workflow_id: session.workflow_id,
    vendor_data: session.vendor_data, created_at: session.created_at,
    id_verification: { status: check(verdict), document_type: 'Identity Card', issuing_state: 'ESP', first_name: 'Ada', last_name: 'Lovelace', date_of_birth: '1985-12-10', document_number: 'FAKE1234', warnings: session.status === 'In Review' ? [{ risk: 'DOCUMENT_PHOTO_BLURRY', short_description: 'Document photo is blurry' }] : [] },
    liveness: { status: check(session.status === 'Declined' ? 'Declined' : 'Approved'), score: session.status === 'Declined' ? 12.5 : 93.1 },
    face_match: { status: check(session.status === 'Declined' ? 'Declined' : 'Approved'), score: session.status === 'Declined' ? 20.2 : 88.4 },
    aml: null,
  };
}

async function sendWebhook(session: Session) {
  const hook = state.get().webhooks[session.api_key];
  if (!hook) return;
  const body = JSON.stringify({ session_id: session.session_id, status: session.status, webhook_type: 'status.updated', vendor_data: session.vendor_data, workflow_id: session.workflow_id, created_at: Math.floor(Date.parse(session.created_at) / 1000), timestamp: Math.floor(Date.now() / 1000) });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = webhookMode === 'bad-signature' ? 'deadbeef' : createHmac('sha256', hook.secret).update(body).digest('hex');
  const times = webhookMode === 'duplicate' ? 2 : 1;
  for (let i = 0; i < times; i++) {
    let status: number | null = null;
    try {
      const response = await fetch(hook.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature, 'X-Timestamp': timestamp }, body, signal: AbortSignal.timeout(10_000) });
      status = response.status;
    } catch { /* receiver down */ }
    webhookLog.push({ at: new Date().toISOString(), url: hook.url, status, body });
  }
}

async function finish(session: Session, status: Status) {
  const updated = { ...session, status, updated_at: new Date().toISOString() };
  save(updated);
  await sendWebhook(updated);
  return updated;
}

const app = service.app;

app.post('/v2/session/', async (c) => {
  const key = apiKeyOf(c);
  if (!authorised(key)) return c.json({ detail: 'Invalid API key' }, 403);
  const body = await c.req.json<{ workflow_id?: string; vendor_data?: string; callback?: string; contact_details?: { email?: string } }>().catch(() => ({} as Record<string, never>));
  if (!body.workflow_id) return c.json({ workflow_id: ['This field is required.'] }, 400);
  const token = randomBytes(12).toString('hex');
  const session: Session = {
    session_id: randomUUID(), session_number: state.get().sessions.length + 1, session_token: token, api_key: key, workflow_id: body.workflow_id,
    vendor_data: body.vendor_data ?? null, callback: body.callback ?? null, email: body.contact_details?.email?.toLowerCase() ?? null,
    status: 'Not Started', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  save(session);
  const preset = session.email ? state.get().decisions[session.email] : undefined;
  if (preset && preset.decision !== 'Abandoned') {
    setTimeout(() => void finish(find((s) => s.session_id === session.session_id)!, preset.decision), preset.delayMs);
  }
  return c.json({ session_id: session.session_id, session_number: session.session_number, session_token: token, url: `${base}/session/${token}`, vendor_data: session.vendor_data, status: session.status, workflow_id: session.workflow_id, callback: session.callback }, 201);
});

app.get('/v2/session/:id/decision/', (c) => {
  if (!authorised(apiKeyOf(c))) return c.json({ detail: 'Invalid API key' }, 403);
  const session = find((s) => s.session_id === c.req.param('id') && s.api_key === apiKeyOf(c));
  return session ? c.json(decision(session)) : c.json({ detail: 'Not found.' }, 404);
});

app.get('/v2/workflows/', (c) => (authorised(apiKeyOf(c)) ? c.json(WORKFLOWS) : c.json({ detail: 'Invalid API key' }, 403)));

// --- hosted verification page ------------------------------------------------------------------------------------------

app.get('/session/:token', (c) => {
  const session = find((s) => s.session_token === c.req.param('token'));
  if (!session) return c.html('<p>This verification link is not valid.</p>', 404);
  const done = !['Not Started', 'In Progress'].includes(session.status);
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Verify your identity</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f8fafc;color:#0f172a}main{max-width:420px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px}
h1{font-size:20px}p{color:#475569;font-size:14px}button{display:block;width:100%;margin:8px 0;padding:12px;border-radius:8px;border:1px solid #cbd5e1;font-size:15px;cursor:pointer;background:#fff}
button.primary{background:#2563eb;color:#fff;border-color:#2563eb}.tag{font-size:12px;color:#64748b}</style></head><body><main>
<p class="tag">Didit (local fake) · session ${session.session_number}</p>
<h1>Verify your identity</h1>
${done ? `<p id="result">Verification finished: <b>${escapeHtml(session.status)}</b>.</p>` : `<p>Take a photo of your ID and a selfie. In this local fake, choose the outcome:</p>
<form method="post" action="/session/${escapeHtml(session.session_token)}/finish">
<button class="primary" name="status" value="Approved">Approve (documents and selfie match)</button>
<button name="status" value="Declined">Decline (document not valid)</button>
<button name="status" value="In Review">Send to manual review</button>
<button name="status" value="Abandoned">Abandon</button>
</form>`}
<script>
  (function () {
    var send = function (type, data) { if (window.parent !== window) window.parent.postMessage({ type: type, data: data || {} }, '*'); };
    send('didit:ready', { sessionId: ${JSON.stringify(session.session_id)} });
    ${done ? `send('didit:completed', { sessionId: ${JSON.stringify(session.session_id)}, status: ${JSON.stringify(session.status)} });` : `document.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { send('didit:started', {}); }); });`}
  })();
</script></main></body></html>`);
});

app.post('/session/:token/finish', async (c) => {
  const session = find((s) => s.session_token === c.req.param('token'));
  if (!session) return c.html('<p>Not found</p>', 404);
  const form = await c.req.parseBody();
  const status = String(form.status) as Status;
  if (!['Approved', 'Declined', 'In Review', 'Abandoned'].includes(status)) return c.html('<p>Unknown outcome</p>', 400);
  if (['Not Started', 'In Progress'].includes(session.status)) await finish(session, status);
  return c.redirect(`/session/${session.session_token}`, 303);
});

// --- control API -------------------------------------------------------------------------------------------------------

app.post('/__control/decisions', async (c) => {
  const { email, decision: outcome, delayMs = 300 } = await c.req.json<{ email: string; decision: Status; delayMs?: number }>();
  const current = state.get();
  state.set({ ...current, decisions: { ...current.decisions, [email.toLowerCase()]: { decision: outcome, delayMs } } });
  return c.json({ email, decision: outcome });
});

app.post('/__control/webhooks', async (c) => {
  const { apiKey, url, secret } = await c.req.json<{ apiKey: string; url: string; secret: string }>();
  const current = state.get();
  state.set({ ...current, webhooks: { ...current.webhooks, [apiKey]: { url, secret } } });
  return c.json({ apiKey, url });
});

app.get('/__control/sessions', (c) => {
  const email = c.req.query('email')?.toLowerCase();
  return c.json(state.get().sessions.filter((s) => !email || s.email === email));
});

app.post('/__control/sessions/:id/complete', async (c) => {
  const session = find((s) => s.session_id === c.req.param('id'));
  if (!session) return c.json({ error: 'not found' }, 404);
  const { status } = await c.req.json<{ status: Status }>();
  return c.json(await finish(session, status));
});

app.post('/__control/webhook-mode', async (c) => {
  ({ mode: webhookMode } = await c.req.json<{ mode: typeof webhookMode }>());
  return c.json({ mode: webhookMode });
});

app.get('/__control/webhook-log', (c) => c.json(webhookLog));

service.start();
