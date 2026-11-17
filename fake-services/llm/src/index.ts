import { createFakeService, devPort, escapeHtml, page } from '@repo/fake-kit';

/**
 * A language model with an OpenAI-compatible API (`POST /v1/chat/completions`, `GET /v1/models`), deterministic so
 * tests can rely on it — it does what the AI connector asks:
 *  - structured extraction (`response_format: { type: 'json_schema' }`): for each property of the schema it looks in
 *    the document text for a line "Label: value" whose label matches the property's name or description, and returns
 *    the JSON object (null when absent; numbers parsed from "$5,400.00");
 *  - anything else: a short answer that summarises the text it was given (first lines, figures).
 * `Authorization: Bearer <key>` (any but "invalid"). `GET /` lists the last completions.
 */
interface Message { role: string; content: string | Array<{ type: string; text?: string }> }
interface Schema { properties?: Record<string, { type?: string | string[]; description?: string }> }

const port = devPort('llm', 9409);
const service = createFakeService({ name: 'llm', port, recordPaths: (p) => p.startsWith('/v1/') });
const history: Array<{ at: string; model: string; kind: string; prompt: string; answer: string }> = [];
service.onReset(() => history.splice(0));
const app = service.app;

const textOf = (messages: Message[], roles = ['user']) => messages.filter((m) => roles.includes(m.role))
  .map((m) => (typeof m.content === 'string' ? m.content : m.content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('\n'))).join('\n');
const words = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !['the', 'of', 'a', 'an', 'in', 'on', 'for', 'as', 'number', 'string', 'date', 'value'].includes(w));

function find(lines: string[], name: string, description?: string) {
  const wanted = new Set([...words(name), ...words(description ?? '').slice(0, 4)]);
  const nameWords = words(name);
  let best: { score: number; value: string } | null = null;
  for (const line of lines) {
    const index = line.indexOf(':');
    if (index < 1) continue;
    const label = words(line.slice(0, index));
    if (!label.length) continue;
    const hits = label.filter((w) => wanted.has(w)).length;
    const exact = nameWords.every((w) => label.includes(w));
    const score = hits + (exact ? 2 : 0) - Math.max(0, label.length - hits - 1) * 0.25;
    if (hits > 0 && (exact || hits >= Math.min(2, label.length)) && (!best || score > best.score)) best = { score, value: line.slice(index + 1).trim() };
  }
  return best?.value ?? null;
}

function typed(value: string | null, type: string | string[] | undefined) {
  if (value === null) return null;
  const kind = Array.isArray(type) ? type.find((t) => t !== 'null') : type;
  if (kind === 'number' || kind === 'integer') {
    const n = Number(value.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) && /\d/.test(value) ? n : null;
  }
  if (kind === 'boolean') return /^(yes|true|y)$/i.test(value);
  return value;
}

const refused = (auth: string) => !/^Bearer\s+\S+/.test(auth) || /invalid$/.test(auth);
const invalidKey = { error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', code: 'invalid_api_key' } };

app.get('/v1/models', (c) => (refused(c.req.header('authorization') ?? '') ? c.json(invalidKey, 401)
  : c.json({ object: 'list', data: [{ id: 'fake-gpt', object: 'model', owned_by: 'fintivio-local' }] })));

app.post('/v1/chat/completions', async (c) => {
  const auth = c.req.header('authorization') ?? '';
  if (!/^Bearer\s+\S+/.test(auth) || /invalid$/.test(auth)) return c.json({ error: { message: 'Incorrect API key provided.', type: 'invalid_request_error', code: 'invalid_api_key' } }, 401);
  const body = await c.req.json<{ model?: string; messages?: Message[]; response_format?: { type: string; json_schema?: { name?: string; schema?: Schema } } }>();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return c.json({ error: { message: 'messages is required', type: 'invalid_request_error' } }, 400);
  const text = textOf(messages);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let answer: string;
  let kind: string;
  if (body.response_format?.type === 'json_schema') {
    kind = 'extraction';
    const properties = body.response_format.json_schema?.schema?.properties ?? {};
    answer = JSON.stringify(Object.fromEntries(Object.entries(properties).map(([name, property]) => [name, typed(find(lines, name, property.description), property.type)])));
  } else {
    kind = 'generation';
    const content = lines.filter((l) => !/^(document|instructions?|task)\b/i.test(l)).slice(0, 6);
    const figures = [...text.matchAll(/\$\s?[\d,]+(?:\.\d{2})?/g)].map((m) => m[0]).slice(0, 4);
    answer = `Summary: ${content.slice(0, 3).join('; ')}${figures.length ? `. Key figures: ${figures.join(', ')}` : ''}.`;
  }
  history.unshift({ at: new Date().toISOString(), model: body.model ?? 'fake-gpt', kind, prompt: text.slice(0, 2000), answer });
  if (history.length > 50) history.pop();
  const promptTokens = Math.ceil(text.length / 4);
  const completionTokens = Math.ceil(answer.length / 4);
  return c.json({
    id: `chatcmpl-${crypto.randomUUID()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: body.model ?? 'fake-gpt',
    choices: [{ index: 0, message: { role: 'assistant', content: answer }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
  });
});

app.get('/', (c) => c.html(page('Language model (local fake)', history.length ? history.map((h) => `<div class="card"><p class="muted">${escapeHtml(h.at)} · ${escapeHtml(h.model)} · ${h.kind}</p><pre>${escapeHtml(h.prompt.slice(0, 800))}</pre><p><b>Answer</b></p><pre>${escapeHtml(h.answer)}</pre></div>`).join('') : '<p class="muted">No completions yet.</p>', '#7c3aed')));

service.start();
