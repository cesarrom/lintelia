import { createFakeService, devPort, escapeHtml, jsonState, page } from '@repo/fake-kit';

/**
 * Google Sheets (the subset of the Sheets API v4 a "log the deal" step uses), reached through the generic HTTP
 * connector — no dedicated connector needed:
 *   POST /v4/spreadsheets/{id}/values/{range}:append?valueInputOption=USER_ENTERED   body { values: [[…]] }
 *   GET  /v4/spreadsheets/{id}/values/{range}
 * `Authorization: Bearer <token>` (any token but "invalid"). `GET /` shows every sheet as a table (watch it fill up).
 * Control: `GET /__control/spreadsheets/{id}`.
 */
interface Sheet { id: string; title: string; rows: string[][]; updatedAt: string }

const port = devPort('sheets', 9412);
const service = createFakeService({ name: 'sheets', port, recordPaths: (p) => p.startsWith('/v4/') });
const state = jsonState<{ sheets: Record<string, Sheet> }>('sheets', 'state.json', { sheets: {} });
service.onReset(() => state.set({ sheets: {} }));
const app = service.app;

const authorised = (header: string | undefined) => /^Bearer\s+\S+/.test(header ?? '') && !/invalid$/.test(header ?? '');
const error = (code: number, status: string, message: string) => ({ error: { code, message, status } });
const cell = (value: unknown) => (value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));

app.post('/v4/spreadsheets/:id/values/:range{.+}', async (c) => {
  if (!authorised(c.req.header('authorization'))) return c.json(error(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.'), 401);
  const raw = decodeURIComponent(c.req.param('range'));
  const range = raw.slice(0, raw.lastIndexOf(':'));
  const action = raw.slice(raw.lastIndexOf(':') + 1);
  if (action !== 'append') return c.json(error(400, 'INVALID_ARGUMENT', `Unknown action ${action}`), 400);
  const body = await c.req.json<{ values?: unknown[][] }>().catch(() => ({} as { values?: unknown[][] }));
  if (!Array.isArray(body.values) || !body.values.every(Array.isArray)) return c.json(error(400, 'INVALID_ARGUMENT', 'values must be a list of rows'), 400);
  const id = c.req.param('id');
  const current = state.get();
  const sheet = current.sheets[id] ?? { id, title: range.split('!')[0] || 'Sheet1', rows: [], updatedAt: '' };
  const start = sheet.rows.length + 1;
  sheet.rows.push(...body.values.map((row) => row.map(cell)));
  sheet.updatedAt = new Date().toISOString();
  state.set({ sheets: { ...current.sheets, [id]: sheet } });
  const width = Math.max(...body.values.map((r) => r.length), 1);
  const updatedRange = `${sheet.title}!A${start}:${String.fromCharCode(64 + Math.min(width, 26))}${sheet.rows.length}`;
  return c.json({ spreadsheetId: id, tableRange: `${sheet.title}!A1`, updates: { spreadsheetId: id, updatedRange, updatedRows: body.values.length, updatedColumns: width, updatedCells: body.values.length * width } });
});

app.get('/v4/spreadsheets/:id/values/:range{.+}', (c) => {
  if (!authorised(c.req.header('authorization'))) return c.json(error(401, 'UNAUTHENTICATED', 'Request had invalid authentication credentials.'), 401);
  const sheet = state.get().sheets[c.req.param('id')];
  if (!sheet) return c.json(error(404, 'NOT_FOUND', 'Requested entity was not found.'), 404);
  return c.json({ range: c.req.param('range'), majorDimension: 'ROWS', values: sheet.rows });
});

app.get('/__control/spreadsheets/:id', (c) => c.json(state.get().sheets[c.req.param('id')] ?? null));

app.get('/', (c) => {
  const sheets = Object.values(state.get().sheets);
  const body = sheets.length ? sheets.map((s) => `<div class="card" data-sheet="${escapeHtml(s.id)}"><h2 style="margin-top:0">${escapeHtml(s.title)} <span class="muted">${escapeHtml(s.id)} · ${s.rows.length} rows · updated ${escapeHtml(s.updatedAt)}</span></h2>
<table><tbody>${s.rows.map((row, i) => `<tr data-row="${i + 1}"><td class="muted">${i + 1}</td>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('')
    : '<p class="muted">No spreadsheet yet: rows appear here when a workflow appends them.</p>';
  return c.html(page('Google Sheets (local fake)', `${body}<script>setTimeout(() => location.reload(), 3000)</script>`, '#0f9d58'));
});

service.start();
