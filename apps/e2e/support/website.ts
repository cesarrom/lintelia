import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A stand-in for an institution's public website: a real HTTP server on the loopback interface (so browsers treat it
 * like any other site, including private-network rules), on its own origin, serving a page with whatever embed
 * snippet the test pastes in.
 */
export class FakeWebsite {
  private server: Server | null = null;
  private html = '<!doctype html><html><body><h1>Coming soon</h1></body></html>';
  origin = '';

  constructor(private readonly host: string) { }

  async start() {
    this.server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this.html);
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.origin = `http://${this.host}:${(this.server.address() as AddressInfo).port}`;
    return this;
  }

  /** Publish a page with `snippet` (e.g. the form embed script) in its body. */
  page(title: string, snippet: string, brand = { name: 'Northwind Bank', initials: 'NB', color: '#0f4c81', hero: 'Banking for people, not paperwork.' }) {
    this.html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#10243a;background:#f4f7fa}
header{background:${brand.color};color:#fff;padding:18px 48px;display:flex;align-items:center;gap:14px}
.logo{width:40px;height:40px;border-radius:10px;background:#fff;color:${brand.color};font-weight:800;display:grid;place-items:center}
header b{font-size:20px}header span{margin-left:auto;opacity:.85;font-size:14px}
.hero{padding:40px 48px 8px}.hero h1{margin:0 0 6px;font-size:34px}.hero p{margin:0;font-size:18px;color:#4a5f75}
main{padding:20px 48px 40px;max-width:760px}footer{padding:18px 48px;color:#6b7f93;font-size:13px;border-top:1px solid #dde5ec}
</style></head><body><header><div class="logo">${brand.initials}</div><b>${brand.name}</b><span>Accounts · Loans · Help</span></header>
<section class="hero"><h1>${title}</h1><p>${brand.hero}</p></section><main>${snippet}</main><footer>${brand.name} · demo website, demo data</footer></body></html>`;
  }

  async stop() {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
