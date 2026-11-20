import { describe, expect, test } from 'bun:test';
import { createClient, LinteliaApiError } from '../src/client';

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

function fakeApi(handler: (call: Call) => { status: number; body?: unknown }) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const call = { method: String(init.method), url, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string> };
    calls.push(call);
    const { status, body } = handler(call);
    return new Response(body === undefined ? '' : JSON.stringify(body), { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const session = (token: string, ttl = 900_000) => ({ token, expiresAt: Date.now() + ttl, refreshToken: `r-${token}`, user: { userId: 'u1', email: 'a@b.c', kind: 'client' } });

describe('headless client', () => {
  test('signs in with a client secret and calls the app API as the client', async () => {
    const api = fakeApi((c) => c.url.endsWith('/auth/client/session') ? { status: 200, body: session('t1') } : { status: 200, body: { available: true } });
    const client = createClient({ apiUrl: 'https://api.example/', tenant: 'demo-bank', fetchClientSecret: async () => 'cs_abc', fetch: api.fetch });
    expect(await client.app<{ available: boolean }>()).toEqual({ available: true });
    expect(api.calls[0]).toMatchObject({ method: 'POST', url: 'https://api.example/auth/client/session', body: { clientSecret: 'cs_abc' } });
    expect(api.calls[1]).toMatchObject({ method: 'GET', url: 'https://api.example/me/app' });
    expect(api.calls[1].headers).toMatchObject({ Authorization: 'Bearer t1', 'X-Tenant': 'demo-bank' });
  });

  test('refreshes an expiring token, signs in again after a 401', async () => {
    let refused = false;
    const api = fakeApi((c) => {
      if (c.url.endsWith('/auth/client/token')) return { status: 200, body: session(refused ? 't3' : 't1', 30_000) };
      if (c.url.endsWith('/auth/refresh')) return { status: 200, body: session('t2') };
      if (c.headers.Authorization === 'Bearer t2' && !refused) { refused = true; return { status: 401, body: { error: 'Unauthorized' } }; }
      return { status: 200, body: { ok: c.headers.Authorization } };
    });
    const client = createClient({ apiUrl: 'https://api.example', tenant: 't', fetchSubjectToken: async () => 'jwt', fetch: api.fetch });
    await client.signIn(); // t1 expires within the margin → refreshed to t2 → 401 → new sign-in (t3)
    expect(await client.data<{ ok: string }>(['me'])).toEqual({ ok: 'Bearer t3' });
    expect(api.calls.map((c) => c.url.replace('https://api.example', ''))).toEqual(['/auth/client/token', '/auth/refresh', '/me/app/data', '/auth/client/token', '/me/app/data']);
  });

  test('API errors carry the status and field errors', async () => {
    const api = fakeApi((c) => c.url.endsWith('/auth/client/session') ? { status: 200, body: session('t') } : { status: 422, body: { error: 'Please check the highlighted fields', errors: [{ field: 'amount', message: 'required' }] } });
    const client = createClient({ apiUrl: 'https://api.example', tenant: 't', fetchClientSecret: async () => 'cs', fetch: api.fetch });
    const error = await client.submitScreen('c1', 't1', 'continue', {}).catch((e: LinteliaApiError) => e) as LinteliaApiError;
    expect(error).toBeInstanceOf(LinteliaApiError);
    expect(error.status).toBe(422);
    expect(error.details).toEqual([{ field: 'amount', message: 'required' }]);
  });
});

describe('live updates', () => {
  test('subscribe streams changes and messages; closing stops it', async () => {
    const encoder = new TextEncoder();
    const calls: string[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push(url);
      if (url.endsWith('/auth/client/session')) return new Response(JSON.stringify(session('t1')), { status: 200 });
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t1');
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('retry: 3000\nevent: ready\ndata: {"topics":[]}\n\n: ping\n\n'));
          controller.enqueue(encoder.encode('event: change\ndata: {"topic":"client/u1/records/accounts"}\n\n'));
          controller.enqueue(encoder.encode('id: 7\nevent: message\ndata: {"topic":"case/c1/channel/progress","seq":7,"payload":{"text":"Checking"}}\n\n'));
          (init.signal as AbortSignal).addEventListener('abort', () => controller.error(new Error('aborted')));
        },
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }) as unknown as typeof globalThis.fetch;
    const client = createClient({ apiUrl: 'https://api.example', tenant: 't', fetchClientSecret: async () => 'cs', fetch });
    const events: unknown[] = [];
    const subscription = client.subscribe(['client/u1/records/*', 'case/c1/channel/*'], (e) => events.push(e), { replay: true });
    await new Promise((r) => setTimeout(r, 50));
    expect(subscription.connected).toBe(true);
    expect(events).toEqual([
      { type: 'change', topic: 'client/u1/records/accounts' },
      { type: 'message', topic: 'case/c1/channel/progress', seq: 7, payload: { text: 'Checking' }, at: undefined },
    ]);
    expect(calls[1]).toContain('/live?topics=client%2Fu1%2Frecords%2F*%2Ccase%2Fc1%2Fchannel%2F*&replay=');
    subscription.close();
  });
});
