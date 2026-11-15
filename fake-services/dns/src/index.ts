import { createFakeService, devPort, escapeHtml, jsonState, page } from '@repo/fake-kit';

/**
 * A DNS zone for local development (custom domain ownership checks, docs/plans/09): `GET /resolve?name=&type=TXT`
 * answers like DNS-over-HTTPS JSON (`{ Answer: [{ name, type, data }] }`); `POST /__control/records { name, type, value }`
 * publishes a record; `DELETE /__control/records?name=` removes it (a dangling record disappearing).
 */
type Record = { name: string; type: 'TXT' | 'CNAME'; value: string };
const service = createFakeService({ name: 'dns', port: devPort('dns', 9408), recordPaths: () => false });
const zone = jsonState<Record[]>('dns', 'zone.json', []);
service.onReset(() => zone.set([]));

service.app.get('/resolve', (c) => {
  const name = (c.req.query('name') ?? '').toLowerCase().replace(/\.$/, '');
  const type = (c.req.query('type') ?? 'TXT').toUpperCase();
  const answers = zone.get().filter((r) => r.name === name && r.type === type);
  return c.json({ Status: answers.length ? 0 : 3, Answer: answers.map((r) => ({ name: r.name, type: r.type, data: r.value })) });
});

service.app.post('/__control/records', async (c) => {
  const record = await c.req.json<Record>();
  const next = { name: record.name.toLowerCase().replace(/\.$/, ''), type: (record.type ?? 'TXT').toUpperCase() as Record['type'], value: record.value };
  zone.set([...zone.get().filter((r) => !(r.name === next.name && r.type === next.type && r.value === next.value)), next]);
  return c.json(next, 201);
});

service.app.delete('/__control/records', (c) => {
  const name = (c.req.query('name') ?? '').toLowerCase();
  zone.set(zone.get().filter((r) => r.name !== name));
  return c.json({ removed: name });
});

service.app.get('/', (c) => c.html(page('Local DNS', `<table><tr><th>Name</th><th>Type</th><th>Value</th></tr>${zone.get().map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${r.type}</td><td>${escapeHtml(r.value)}</td></tr>`).join('')}</table>`)));

service.start();
