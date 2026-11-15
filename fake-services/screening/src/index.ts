import { randomUUID } from 'node:crypto';
import { createFakeService, devPort, jsonState } from '@repo/fake-kit';

/**
 * A screening vendor (sanctions, PEP, adverse media), shaped like the common vendor APIs: `POST /v1/searches` with
 * `Authorization: Token <key>` and `{ name, birth_year?, country?, lists[] }` → `{ id, result, matches[] }`.
 * `POST /__control/results { name, result, matches }` presets what a name returns (default: clear).
 */
interface Match { list: string; name: string; score: number }
const service = createFakeService({ name: 'screening', port: devPort('screening', 9407), recordPaths: (p) => p.startsWith('/v1') });
const presets = jsonState<Record<string, { result: 'clear' | 'potential_match'; matches: Match[] }>>('screening', 'presets.json', {});
service.onReset(() => presets.set({}));

service.app.post('/v1/searches', async (c) => {
  const key = c.req.header('authorization')?.replace(/^Token\s+/i, '') ?? '';
  if (!key || key === 'invalid') return c.json({ message: 'Invalid API key' }, 401);
  const body = await c.req.json<{ name?: string; lists?: string[] }>();
  if (!body.name) return c.json({ message: 'name is required' }, 422);
  const preset = presets.get()[body.name.trim().toLowerCase()] ?? { result: 'clear' as const, matches: [] };
  const lists = body.lists?.length ? body.lists : ['sanctions', 'pep', 'adverse_media'];
  const matches = preset.matches.filter((m) => lists.includes(m.list));
  return c.json({ id: `search_${randomUUID()}`, result: matches.length ? 'potential_match' : 'clear', matches, lists, searched_at: new Date().toISOString() });
});

service.app.get('/v1/account', (c) => {
  const key = c.req.header('authorization')?.replace(/^Token\s+/i, '') ?? '';
  return key && key !== 'invalid' ? c.json({ account: 'local', lists: ['sanctions', 'pep', 'adverse_media'] }) : c.json({ message: 'Invalid API key' }, 401);
});

service.app.post('/__control/results', async (c) => {
  const { name, result, matches = [] } = await c.req.json<{ name: string; result: 'clear' | 'potential_match'; matches?: Match[] }>();
  presets.set({ ...presets.get(), [name.trim().toLowerCase()]: { result, matches: result === 'clear' ? [] : matches } });
  return c.json({ name, result });
});

service.start();
