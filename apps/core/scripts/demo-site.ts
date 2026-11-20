/**
 * The Demo Bank public website (`bun run demo:site`, http://localhost:4000), showing the two ways an institution puts
 * Lintelia in its own site:
 *  - `/`: the loan application form, embedded with the forms snippet (published by the seed for this origin);
 *  - `/online-banking`: the client app (banking), embedded with `@lintelia/client-sdk`. The site's backend opens a
 *    client session for its signed-in customer (`POST /client-sessions` with its API client) and the SDK hands the
 *    single-use secret to the app.
 */
import { DEMO_LOAN_FORM_KEY, DEMO_SITE_API_CLIENT_ID, DEMO_SITE_API_CLIENT_SECRET, DEMO_SITE_ORIGIN } from './seed';

const port = Number(new URL(DEMO_SITE_ORIGIN).port);
const webHost = process.env.DEMO_TENANT_WEB ?? 'http://demo-bank.localhost:3001';
const apiUrl = process.env.DEMO_API_URL ?? process.env.API_URL ?? 'http://localhost:8000';

/** The website's own customers (its own sign-in is out of scope: pick one). */
const CUSTOMERS: Record<string, { externalId: string; email: string; name: string; customerNumber: string; label: string }> = {
  chris: { externalId: 'C-1001', email: 'client@demo-bank.test', name: 'Chris Client', customerNumber: 'C-1001', label: 'Chris Client — existing customer' },
  sam: { externalId: 'C-2002', email: 'sam.taylor@demo-bank.test', name: 'Sam Taylor', customerNumber: 'C-2002', label: 'Sam Taylor — new to the bank' },
};

const STYLE = `
  body { margin: 0; font-family: system-ui, sans-serif; color: #0f172a; background: #f1f5f9; }
  header { background: #0b3d91; color: #fff; padding: 18px 40px; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  header h1 { margin: 0; font-size: 24px; } header p { margin: 4px 0 0; opacity: .85; }
  header nav a { color: #fff; opacity: .85; text-decoration: none; margin-left: 20px; font-weight: 500; } header nav a[aria-current] { opacity: 1; border-bottom: 2px solid #fff; padding-bottom: 4px; }
  main { padding: 32px 40px; max-width: 1240px; margin: auto; }
  .grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 32px; }
  .pitch h2 { margin-top: 0; } .pitch li { margin: 8px 0; }
  .bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; }
  .bar select { font: inherit; padding: 6px 8px; border-radius: 8px; border: 1px solid #cbd5e1; }
  .frame { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px -12px rgba(15,23,42,.25); }
  #events { font: 12px ui-monospace, monospace; color: #475569; margin-top: 12px; white-space: pre-wrap; max-height: 140px; overflow: auto; }
`;

const header = (current: 'loans' | 'banking') => `
  <header>
    <div><h1>Demo Bank</h1><p>${current === 'loans' ? 'Personal loans up to 100,000 — answer in minutes' : 'Online banking'}</p></div>
    <nav><a href="/" ${current === 'loans' ? 'aria-current="page"' : ''}>Loans</a><a href="/online-banking" ${current === 'banking' ? 'aria-current="page"' : ''} data-testid="nav-online-banking">Online banking</a></nav>
  </header>`;

const loansPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo Bank — Personal loans</title>
  <style>${STYLE}</style>
</head>
<body>
  ${header('loans')}
  <main class="grid">
    <section class="pitch">
      <h2>How much can you borrow?</h2>
      <ul><li>Fixed 8.9% rate</li><li>12 to 84 months</li><li>Small loans pre-approved instantly</li></ul>
      <p>We will e-mail you a code to confirm your address, then follow your application in your Demo Bank portal.</p>
    </section>
    <section>
      <script src="${webHost}/embed.js" data-lintelia-form="${DEMO_LOAN_FORM_KEY}" data-title="Personal loan pre-approval" async></script>
    </section>
  </main>
</body>
</html>`;

const bankingPage = (customer: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo Bank — Online banking</title>
  <style>${STYLE}</style>
  <script src="${webHost}/lintelia-client.js"></script>
</head>
<body>
  ${header('banking')}
  <main>
    <div class="bar">
      <span>Signed in to demobank.example as</span>
      <select id="customer" data-testid="customer" onchange="location.search='?customer='+this.value">
        ${Object.entries(CUSTOMERS).map(([key, c]) => `<option value="${key}" ${key === customer ? 'selected' : ''}>${c.label}</option>`).join('')}
      </select>
      <span style="color:#64748b">The app below is Lintelia, embedded with <code>@lintelia/client-sdk</code>.</span>
    </div>
    <div class="frame" id="banking"></div>
    <div id="events" data-testid="sdk-events"></div>
  </main>
  <script>
    const log = (line) => { const el = document.getElementById('events'); el.textContent = line + '\\n' + el.textContent; };
    window.linteliaApp = LinteliaClient.mount('#banking', {
      appUrl: ${JSON.stringify(webHost)},
      height: 780,
      title: 'Demo Bank online banking',
      fetchClientSecret: async () => {
        const response = await fetch('/api/lintelia/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer: ${JSON.stringify(customer)} }) });
        if (!response.ok) throw new Error('Could not open a session');
        log('session: client secret obtained by the site backend');
        return (await response.json()).clientSecret;
      },
      onReady: (page) => log('ready: ' + page),
      onNavigate: (page) => log('page: ' + page),
      onEvent: (event) => { if (event.name !== 'page.viewed') log('event: ' + event.name + ' ' + JSON.stringify(event.detail)); },
      onError: (error) => log('error: ' + error.message),
    });
  </script>
</body>
</html>`;

/** The site's backend: an OAuth token of its API client (cached), then a client session for the signed-in customer. */
let token: { value: string; expiresAt: number } | null = null;
async function apiToken() {
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const response = await fetch(`${apiUrl}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: DEMO_SITE_API_CLIENT_ID, client_secret: DEMO_SITE_API_CLIENT_SECRET }),
  });
  if (!response.ok) throw new Error(`token: ${response.status} ${await response.text()}`);
  const body = await response.json() as { access_token: string; expires_in: number };
  token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function openClientSession(customerKey: string) {
  const customer = CUSTOMERS[customerKey] ?? CUSTOMERS.chris;
  const response = await fetch(`${apiUrl}/client-sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await apiToken()}` },
    body: JSON.stringify({ externalId: customer.externalId, email: customer.email, name: customer.name, attributes: { customerNumber: customer.customerNumber } }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`client session: ${response.status} ${JSON.stringify(body)}`);
  return { clientSecret: body.clientSecret as string };
}

const html = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/online-banking') return html(bankingPage(url.searchParams.get('customer') ?? 'chris'));
      if (url.pathname === '/api/lintelia/session' && request.method === 'POST') {
        const { customer } = await request.json().catch(() => ({})) as { customer?: string };
        return Response.json(await openClientSession(customer ?? 'chris'));
      }
      if (url.pathname === '/__health') return new Response('ok');
      return html(loansPage);
    } catch (error) {
      console.error(error);
      return Response.json({ error: (error as Error).message }, { status: 502 });
    }
  },
});
console.log(`Demo Bank website on ${DEMO_SITE_ORIGIN} (loan form: ${webHost}/embed/forms/${DEMO_LOAN_FORM_KEY}; online banking: ${DEMO_SITE_ORIGIN}/online-banking)`);
