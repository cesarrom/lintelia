import { randomBytes } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createFakeService, devPort, escapeHtml, jsonState } from '@repo/fake-kit';

/**
 * Documenso (docs/plans/05): the subset of the v2 API (docs/vendor-api/documenso-openapi-v2.json) the connector uses,
 * under `/api/v2`, with `Authorization: <api key>`:
 *   GET /template, GET /template/{id}, POST /template/use, GET /document/{id}, GET /document/{id}/download?version=signed
 * plus the recipient signing page `/sign/{token}` (Sign / Decline) and webhooks (assumed: events `DOCUMENT_SIGNED`,
 * `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, header `X-Documenso-Secret`; see integrations/documenso/docs/ASSUMPTIONS.md).
 *
 * Control API: `/__control/signatures` presets the outcome per signer e-mail (signed | declined complete automatically),
 * `/__control/webhooks` registers the webhook URL + secret for an API key (what an admin does in Documenso's settings),
 * `/__control/documents`.
 */
interface Recipient { id: number; email: string; name: string; role: 'SIGNER'; token: string; signingStatus: 'NOT_SIGNED' | 'SIGNED' | 'REJECTED'; signedAt: string | null; rejectionReason: string | null }
interface Document { id: number; envelopeId: string; apiKey: string; templateId: number; title: string; externalId: string | null; status: 'PENDING' | 'COMPLETED' | 'REJECTED'; recipients: Recipient[]; createdAt: string; completedAt: string | null }

const port = devPort('documenso', 9402);
const base = process.env.DOCUMENSO_FAKE_PUBLIC_URL ?? `http://localhost:${port}`;
const service = createFakeService({ name: 'documenso', port, recordPaths: (p) => p.startsWith('/api/') });
const TEMPLATES = [
  { id: 101, title: 'Retail account agreement', externalId: 'retail-account-agreement', recipients: [{ id: 1, role: 'SIGNER', email: '', name: 'Account holder' }] },
  { id: 102, title: 'Loan agreement', externalId: 'loan-agreement', recipients: [{ id: 1, role: 'SIGNER', email: '', name: 'Borrower' }] },
  { id: 103, title: 'Retail installment contract', externalId: 'retail-installment-contract', recipients: [{ id: 1, role: 'SIGNER', email: '', name: 'Buyer' }] },
  { id: 104, title: 'Dealer assignment of contract', externalId: 'dealer-assignment', recipients: [{ id: 1, role: 'SIGNER', email: '', name: 'Dealer' }] },
];
const state = jsonState<{ documents: Document[]; webhooks: Record<string, { url: string; secret: string }>; outcomes: Record<string, 'signed' | 'declined' | 'none'> }>(
  'documenso', 'state.json', { documents: [], webhooks: {}, outcomes: {} },
);
service.onReset(() => state.set({ documents: [], webhooks: {}, outcomes: {} }));

const keyOf = (c: { req: { header(name: string): string | undefined } }) => (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
const authorised = (key: string) => key.length > 0 && key !== 'invalid';
const unauthorised = { message: 'Unauthorized', code: 'UNAUTHORIZED' };
const save = (doc: Document) => {
  const current = state.get();
  state.set({ ...current, documents: [...current.documents.filter((d) => d.id !== doc.id), doc] });
};
const view = (doc: Document) => ({
  id: doc.id, envelopeId: doc.envelopeId, externalId: doc.externalId, title: doc.title, status: doc.status, templateId: doc.templateId, source: 'TEMPLATE',
  createdAt: doc.createdAt, updatedAt: doc.completedAt ?? doc.createdAt, completedAt: doc.completedAt,
  recipients: doc.recipients.map((r) => ({ ...r, envelopeId: doc.envelopeId, readStatus: 'OPENED', sendStatus: 'SENT', documentId: doc.id, templateId: doc.templateId })),
});

async function webhook(doc: Document, event: string) {
  const hook = state.get().webhooks[doc.apiKey];
  if (!hook) return;
  await fetch(hook.url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Documenso-Secret': hook.secret },
    body: JSON.stringify({ event, payload: view(doc), createdAt: new Date().toISOString(), webhookEndpoint: hook.url }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

async function sign(doc: Document, recipientId: number, outcome: 'signed' | 'declined') {
  const at = new Date().toISOString();
  const recipients = doc.recipients.map((r) => r.id === recipientId ? { ...r, signingStatus: outcome === 'signed' ? 'SIGNED' as const : 'REJECTED' as const, signedAt: outcome === 'signed' ? at : null, rejectionReason: outcome === 'declined' ? 'Declined by signer' : null } : r);
  const completed = recipients.every((r) => r.signingStatus === 'SIGNED');
  const updated: Document = { ...doc, recipients, status: outcome === 'declined' ? 'REJECTED' : completed ? 'COMPLETED' : 'PENDING', completedAt: completed ? at : null };
  save(updated);
  if (outcome === 'declined') await webhook(updated, 'DOCUMENT_REJECTED');
  else {
    await webhook(updated, 'DOCUMENT_SIGNED');
    if (completed) await webhook(updated, 'DOCUMENT_COMPLETED');
  }
  return updated;
}

async function signedPdf(doc: Document) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(doc.title, { x: 50, y: 780, size: 18, font });
  page.drawText(`Document ${doc.id} (${doc.externalId ?? 'no reference'})`, { x: 50, y: 750, size: 11, font });
  doc.recipients.forEach((r, i) => page.drawText(`Signed by ${r.name} <${r.email}> on ${r.signedAt}`, { x: 50, y: 700 - i * 20, size: 11, font, color: rgb(0, 0.4, 0) }));
  pdf.setProducer('Documenso (local fake)');
  return Buffer.from(await pdf.save());
}

const app = service.app;
const api = '/api/v2';

app.get(`${api}/template`, (c) => authorised(keyOf(c)) ? c.json({ data: TEMPLATES.map(({ recipients: _r, ...t }) => ({ ...t, type: 'PRIVATE' })), count: TEMPLATES.length, currentPage: 1, perPage: 10, totalPages: 1 }) : c.json(unauthorised, 401));
app.get(`${api}/template/:id`, (c) => {
  if (!authorised(keyOf(c))) return c.json(unauthorised, 401);
  const template = TEMPLATES.find((t) => t.id === Number(c.req.param('id')));
  return template ? c.json(template) : c.json({ message: 'Template not found', code: 'NOT_FOUND' }, 404);
});

app.post(`${api}/template/use`, async (c) => {
  const key = keyOf(c);
  if (!authorised(key)) return c.json(unauthorised, 401);
  const body = await c.req.json<{ templateId: number; externalId?: string; recipients: Array<{ id: number; email: string; name?: string }>; distributeDocument?: boolean }>();
  const template = TEMPLATES.find((t) => t.id === Number(body.templateId));
  if (!template) return c.json({ message: 'Template not found', code: 'NOT_FOUND' }, 404);
  if (!body.recipients?.length || body.recipients.some((r) => !r.email)) return c.json({ message: 'Recipients need an e-mail', code: 'INVALID_BODY' }, 400);
  const doc: Document = {
    id: Math.floor(1000 + Math.random() * 900000), envelopeId: `envelope_${randomBytes(8).toString('hex')}`, apiKey: key, templateId: template.id, title: template.title,
    externalId: body.externalId ?? null, status: 'PENDING', createdAt: new Date().toISOString(), completedAt: null,
    recipients: body.recipients.map((r) => ({ id: r.id, email: r.email.toLowerCase(), name: r.name ?? r.email, role: 'SIGNER' as const, token: randomBytes(12).toString('hex'), signingStatus: 'NOT_SIGNED' as const, signedAt: null, rejectionReason: null })),
  };
  save(doc);
  for (const recipient of doc.recipients) {
    const preset = state.get().outcomes[recipient.email];
    if (preset && preset !== 'none') setTimeout(() => void sign(state.get().documents.find((d) => d.id === doc.id)!, recipient.id, preset), 300);
  }
  return c.json(view(doc));
});

app.get(`${api}/document/:id`, (c) => {
  if (!authorised(keyOf(c))) return c.json(unauthorised, 401);
  const doc = state.get().documents.find((d) => d.id === Number(c.req.param('id')) && d.apiKey === keyOf(c));
  return doc ? c.json(view(doc)) : c.json({ message: 'Document not found', code: 'NOT_FOUND' }, 404);
});

app.get(`${api}/document/:id/download`, async (c) => {
  if (!authorised(keyOf(c))) return c.json(unauthorised, 401);
  const doc = state.get().documents.find((d) => d.id === Number(c.req.param('id')) && d.apiKey === keyOf(c));
  if (!doc) return c.json({ message: 'Document not found', code: 'NOT_FOUND' }, 404);
  if (c.req.query('version') !== 'original' && doc.status !== 'COMPLETED') return c.json({ message: 'Document is not completed', code: 'INVALID_REQUEST' }, 400);
  return new Response(new Uint8Array(await signedPdf(doc)), { headers: { 'Content-Type': 'application/pdf' } });
});

// --- signing page ------------------------------------------------------------------------------------------------------

app.get('/sign/:token', (c) => {
  const doc = state.get().documents.find((d) => d.recipients.some((r) => r.token === c.req.param('token')));
  const recipient = doc?.recipients.find((r) => r.token === c.req.param('token'));
  if (!doc || !recipient) return c.html('<p>This signing link is not valid.</p>', 404);
  const done = recipient.signingStatus !== 'NOT_SIGNED';
  return c.html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sign: ${escapeHtml(doc.title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f1f5f9;margin:0}main{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0}
.doc{border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin:12px 0;font-size:14px;color:#334155}button{padding:12px 18px;border-radius:8px;border:1px solid #cbd5e1;font-size:15px;cursor:pointer;margin-right:8px}
button.primary{background:#16a34a;color:#fff;border-color:#16a34a}.tag{font-size:12px;color:#64748b}</style></head><body><main>
<p class="tag">Documenso (local fake)</p><h1>${escapeHtml(doc.title)}</h1>
<div class="doc">I, ${escapeHtml(recipient.name)}, agree to the terms of this ${escapeHtml(doc.title.toLowerCase())}.</div>
${done ? `<p id="result">You ${recipient.signingStatus === 'SIGNED' ? 'signed' : 'declined'} this document.</p>` : `<form method="post" action="/sign/${escapeHtml(recipient.token)}">
<button class="primary" name="outcome" value="signed">Sign</button><button name="outcome" value="declined">Decline</button></form>`}
<script>if (window.parent !== window) window.parent.postMessage({ type: ${JSON.stringify(done ? (recipient.signingStatus === 'SIGNED' ? 'document-completed' : 'document-rejected') : 'document-ready')}, data: { documentId: ${doc.id} } }, '*');</script>
</main></body></html>`);
});

app.post('/sign/:token', async (c) => {
  const doc = state.get().documents.find((d) => d.recipients.some((r) => r.token === c.req.param('token')));
  const recipient = doc?.recipients.find((r) => r.token === c.req.param('token'));
  if (!doc || !recipient) return c.html('<p>Not found</p>', 404);
  const form = await c.req.parseBody();
  if (recipient.signingStatus === 'NOT_SIGNED') await sign(doc, recipient.id, form.outcome === 'declined' ? 'declined' : 'signed');
  return c.redirect(`/sign/${recipient.token}`, 303);
});

// --- control ---------------------------------------------------------------------------------------------------------

app.post('/__control/signatures', async (c) => {
  const { email, outcome } = await c.req.json<{ email: string; outcome: 'signed' | 'declined' | 'none' }>();
  const current = state.get();
  state.set({ ...current, outcomes: { ...current.outcomes, [email.toLowerCase()]: outcome } });
  return c.json({ email, outcome });
});
app.post('/__control/webhooks', async (c) => {
  const { apiKey, url, secret } = await c.req.json<{ apiKey: string; url: string; secret: string }>();
  const current = state.get();
  state.set({ ...current, webhooks: { ...current.webhooks, [apiKey]: { url, secret } } });
  return c.json({ apiKey, url });
});
app.get('/__control/documents', (c) => {
  const email = c.req.query('email')?.toLowerCase();
  return c.json(state.get().documents.filter((d) => !email || d.recipients.some((r) => r.email === email)));
});

console.log(`[documenso] API base ${base}${api}`);
service.start();
