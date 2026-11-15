/**
 * Local mailbox (docs/plans/08): an SMTP server that accepts every message, a web inbox to read them and a REST API
 * for tests (`GET /api/messages?to=&tenant=&since=`). Messages persist in `.data/fake-services/mailbox`.
 *
 *   SMTP  localhost:1025 (no TLS, any credentials accepted)
 *   Web   http://localhost:8025
 */
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { randomUUID } from 'node:crypto';
import { createFakeService, devPort, escapeHtml, jsonState, page } from '@repo/fake-kit';

interface StoredMessage {
  id: string;
  receivedAt: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  tenant: string | null;
  headers: Record<string, string>;
  links: string[];
  codes: string[];
}

const MAX_MESSAGES = 3000;
const store = jsonState<StoredMessage[]>('mailbox', 'messages.json', []);
let failNext = 0;

const service = createFakeService({ name: 'mailbox', port: devPort('mailbox', 8025), recordPaths: () => false });
service.onReset(() => store.set([]));

const extractLinks = (text: string, html: string | null) =>
  [...new Set(`${text} ${html ?? ''}`.match(/https?:\/\/[^\s"'<>]+/g) ?? [])].map((l) => l.replace(/&amp;/g, '&'));
const extractCodes = (text: string) => [...new Set(text.match(/\b\d{6}\b/g) ?? [])];

// --- SMTP ------------------------------------------------------------------------------------------------------------

const smtp = new SMTPServer({
  authOptional: true,
  allowInsecureAuth: true,
  disabledCommands: ['STARTTLS'],
  logger: false,
  // Any credentials work except the password "wrong" (to exercise connectors' credential checks).
  onAuth(auth, _session, callback) {
    if (auth.password === 'wrong') return callback(new Error('Invalid username or password'));
    callback(null, { user: auth.username ?? 'local' });
  },
  onData(stream, session, callback) {
    if (failNext > 0) {
      failNext -= 1;
      stream.resume();
      const error = new Error('Mailbox is configured to refuse this message') as Error & { responseCode: number };
      error.responseCode = 451;
      return callback(error);
    }
    simpleParser(stream).then((parsed) => {
      const text = parsed.text ?? '';
      const html = typeof parsed.html === 'string' ? parsed.html : null;
      const headers: Record<string, string> = {};
      for (const [key, value] of parsed.headers) headers[key] = typeof value === 'string' ? value : JSON.stringify(value);
      const recipients = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
      const message: StoredMessage = {
        id: randomUUID(),
        receivedAt: new Date().toISOString(),
        from: parsed.from?.text ?? session.envelope.mailFrom?.toString() ?? '',
        to: recipients,
        subject: parsed.subject ?? '',
        text,
        html,
        tenant: headers['x-fintivio-tenant'] ?? null,
        headers,
        links: extractLinks(text, html),
        codes: extractCodes(`${parsed.subject ?? ''} ${text}`),
      };
      const messages = [...store.get(), message];
      store.set(messages.slice(-MAX_MESSAGES));
      callback();
    }).catch((error) => callback(error));
  },
});
const smtpPort = devPort('mailbox-smtp', 1025);
smtp.listen(smtpPort, () => console.log(`[mailbox] SMTP listening on localhost:${smtpPort}`));

// --- REST API ----------------------------------------------------------------------------------------------------------

const { app } = service;

const filtered = (query: { to?: string; tenant?: string; since?: string; subject?: string }) => {
  const since = query.since ? Date.parse(query.since) || Number(query.since) : 0;
  return store.get()
    .filter((m) => !query.to || m.to.includes(query.to.toLowerCase()))
    .filter((m) => !query.tenant || m.tenant === query.tenant)
    .filter((m) => !since || Date.parse(m.receivedAt) >= since)
    .filter((m) => !query.subject || m.subject.toLowerCase().includes(query.subject.toLowerCase()))
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
};

app.get('/api/messages', (c) => c.json(filtered(c.req.query())));
app.get('/api/messages/:id', (c) => {
  const message = store.get().find((m) => m.id === c.req.param('id'));
  return message ? c.json(message) : c.json({ error: 'not found' }, 404);
});
app.delete('/api/messages', (c) => {
  store.set([]);
  return c.json({ deleted: true });
});
/** Refuse the next n messages with a temporary SMTP error (tests of senders' retries). */
app.post('/__control/fail-next', async (c) => {
  const { count = 1 } = await c.req.json<{ count?: number }>().catch(() => ({ count: 1 }));
  failNext = count;
  return c.json({ failNext });
});

// --- Web inbox -------------------------------------------------------------------------------------------------------

app.get('/', (c) => {
  const query = c.req.query();
  const messages = filtered(query).slice(0, 300);
  const rows = messages.map((m) => `<tr>
    <td class="muted">${escapeHtml(new Date(m.receivedAt).toLocaleString())}</td>
    <td>${escapeHtml(m.to.join(', '))}</td>
    <td><a href="/messages/${m.id}">${escapeHtml(m.subject || '(no subject)')}</a>${m.codes.length ? ` <b title="one-time code">${escapeHtml(m.codes[0])}</b>` : ''}</td>
    <td class="muted">${escapeHtml(m.tenant ?? '')}</td></tr>`).join('');
  return c.html(page('Local mailbox', `
    <form class="card" method="get">
      <input name="to" placeholder="recipient" value="${escapeHtml(query.to ?? '')}">
      <input name="tenant" placeholder="tenant" value="${escapeHtml(query.tenant ?? '')}">
      <input name="subject" placeholder="subject contains" value="${escapeHtml(query.subject ?? '')}">
      <button>Filter</button> <a href="/">clear</a>
      <span class="muted" style="float:right">SMTP on localhost:${smtpPort} · ${store.get().length} messages · auto-refresh 5 s</span>
    </form>
    <table><thead><tr><th>Received</th><th>To</th><th>Subject</th><th>Tenant</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No messages yet.</td></tr>'}</tbody></table>
    <script>setTimeout(() => location.reload(), 5000)</script>`));
});

app.get('/messages/:id', (c) => {
  const m = store.get().find((x) => x.id === c.req.param('id'));
  if (!m) return c.html(page('Local mailbox', '<p>Not found. <a href="/">Back</a></p>'), 404);
  const links = m.links.map((l) => `<li><a href="${escapeHtml(l)}" target="_blank" rel="noreferrer">${escapeHtml(l)}</a></li>`).join('');
  return c.html(page('Local mailbox', `
    <p><a href="/">← Inbox</a></p>
    <div class="card">
      <div class="muted">${escapeHtml(new Date(m.receivedAt).toLocaleString())} · from ${escapeHtml(m.from)} · to ${escapeHtml(m.to.join(', '))}${m.tenant ? ` · tenant ${escapeHtml(m.tenant)}` : ''}</div>
      <h2>${escapeHtml(m.subject)}</h2>
      ${m.codes.length ? `<p>Code: <b style="font-size:22px;letter-spacing:3px" data-testid="code">${escapeHtml(m.codes[0])}</b></p>` : ''}
      ${links ? `<p><b>Links</b></p><ul>${links}</ul>` : ''}
    </div>
    ${m.html ? `<div class="card"><iframe title="HTML body" sandbox="" style="width:100%;height:480px;border:0" srcdoc="${escapeHtml(m.html)}"></iframe></div>` : ''}
    <div class="card"><b>Text</b><pre>${escapeHtml(m.text)}</pre></div>`));
});

service.start();
