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
  page(title: string, snippet: string) {
    this.html = `<!doctype html><html><head><title>${title}</title></head><body><header><h1>${title}</h1><p>Apply in minutes.</p></header><main>${snippet}</main></body></html>`;
  }

  async stop() {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
