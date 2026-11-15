/**
 * The Demo Bank public website, with the loan application form embedded (the snippet an institution pastes into its
 * own site). Run `bun run demo:site` and open http://localhost:4000. The form is published by the seed for this origin.
 */
import { DEMO_LOAN_FORM_KEY, DEMO_SITE_ORIGIN } from './seed';

const port = Number(new URL(DEMO_SITE_ORIGIN).port);
const webHost = process.env.DEMO_TENANT_WEB ?? 'http://demo-bank.localhost:3001';

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo Bank — Personal loans</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #0f172a; background: #f1f5f9; }
    header { background: #0b3d91; color: #fff; padding: 24px 40px; }
    header h1 { margin: 0; font-size: 28px; } header p { margin: 8px 0 0; opacity: .85; }
    main { display: grid; grid-template-columns: 1fr 1.2fr; gap: 32px; padding: 40px; max-width: 1200px; margin: auto; }
    .pitch h2 { margin-top: 0; } .pitch li { margin: 8px 0; }
  </style>
</head>
<body>
  <header><h1>Demo Bank</h1><p>Personal loans up to 100,000 — answer in minutes</p></header>
  <main>
    <section class="pitch">
      <h2>How much can you borrow?</h2>
      <ul><li>Fixed 8.9% rate</li><li>12 to 84 months</li><li>Small loans pre-approved instantly</li></ul>
      <p>We will e-mail you a code to confirm your address, then follow your application in your Demo Bank portal.</p>
    </section>
    <section>
      <script src="${webHost}/embed.js" data-fintivio-form="${DEMO_LOAN_FORM_KEY}" data-title="Personal loan pre-approval" async></script>
    </section>
  </main>
</body>
</html>`;

Bun.serve({ port, fetch: () => new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) });
console.log(`Demo Bank website on ${DEMO_SITE_ORIGIN} (embeds ${webHost}/embed/forms/${DEMO_LOAN_FORM_KEY})`);
