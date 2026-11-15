import { env } from './env';

type FakeName = keyof typeof env.fakes;

/**
 * Local fakes of external systems, each exposing `GET /__health` and a `/__control/*` API for tests.
 * Tests that need one call `requireFake` first so they fail with an explicit reason while the fake is not built.
 */
export async function requireFake(name: FakeName) {
  const url = env.fakes[name];
  try {
    const res = await fetch(new URL('/__health', url), { signal: AbortSignal.timeout(2000) });
    if (res.ok) return url;
  } catch {
    // fall through
  }
  throw new Error(`Fake "${name}" is not running at ${url} (planned, see docs/testing/e2e.md#fakes)`);
}

/** Configure the next outcome of a fake (e.g. Didit decision, Documenso signing result). */
export async function controlFake(name: FakeName, path: string, body: unknown) {
  const url = await requireFake(name);
  const res = await fetch(new URL(`/__control${path}`, url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Fake ${name} control ${path} failed: ${res.status} ${await res.text()}`);
  return res.json().catch(() => ({}));
}

/** Read what a fake received (e.g. webhook deliveries, SMS messages). */
export async function fakeRecords<T = any>(name: FakeName, path: string): Promise<T> {
  const url = await requireFake(name);
  const res = await fetch(new URL(`/__control${path}`, url));
  return res.json() as Promise<T>;
}
