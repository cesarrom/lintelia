import { createFakeService, devPort, escapeHtml, jsonState, page } from '@repo/fake-kit';

/**
 * QuickBooks Online (the subset of the Accounting API v3 a "pay the dealer" function uses through the generic HTTP
 * connector), per company (`realm`):
 *   GET  /v3/company/{realm}/query?query=select * from Vendor where DisplayName = 'X'
 *   POST /v3/company/{realm}/vendor        { DisplayName, PrimaryEmailAddr? }
 *   POST /v3/company/{realm}/bill          { VendorRef: { value }, Line: [{ Amount, DetailType, AccountBasedExpenseLineDetail }], DocNumber?, PrivateNote? }
 *   POST /v3/company/{realm}/billpayment   { VendorRef, PayType: 'Check', TotalAmt, Line: [{ Amount, LinkedTxn: [{ TxnId, TxnType: 'Bill' }] }] }
 * `Authorization: Bearer <token>` (any but "invalid"). Answers wrap the entity (`{ Vendor: {…} }`), like Intuit's.
 * `GET /` shows the books (vendors, bills, payments).
 */
interface Vendor { Id: string; DisplayName: string; PrimaryEmailAddr?: { Address: string }; Balance: number; MetaData: { CreateTime: string } }
interface Bill { Id: string; DocNumber: string | null; VendorRef: { value: string; name: string }; TotalAmt: number; Balance: number; PrivateNote: string | null; TxnDate: string }
interface Payment { Id: string; VendorRef: { value: string; name: string }; TotalAmt: number; BillId: string; TxnDate: string }
interface Company { vendors: Vendor[]; bills: Bill[]; payments: Payment[] }

const port = devPort('quickbooks', 9411);
const service = createFakeService({ name: 'quickbooks', port, recordPaths: (p) => p.startsWith('/v3/') });
const state = jsonState<{ companies: Record<string, Company>; next: number }>('quickbooks', 'state.json', { companies: {}, next: 100 });
service.onReset(() => state.set({ companies: {}, next: 100 }));
const app = service.app;

const authorised = (header: string | undefined) => /^Bearer\s+\S+/.test(header ?? '') && !/invalid$/.test(header ?? '');
const fault = (message: string, code = '2020') => ({ Fault: { Error: [{ Message: message, Detail: message, code }], type: 'ValidationFault' }, time: new Date().toISOString() });
const today = () => new Date().toISOString().slice(0, 10);

function company(realm: string) {
  const current = state.get();
  return current.companies[realm] ?? { vendors: [], bills: [], payments: [] };
}
function save(realm: string, next: Company) {
  const current = state.get();
  state.set({ ...current, companies: { ...current.companies, [realm]: next } });
}
function nextId() {
  const current = state.get();
  state.set({ ...current, next: current.next + 1 });
  return String(current.next + 1);
}

app.use('/v3/*', async (c, next) => {
  if (!authorised(c.req.header('authorization'))) return c.json({ Fault: { Error: [{ Message: 'AuthenticationFailed', code: '3200' }], type: 'AUTHENTICATION' } }, 401);
  await next();
});

app.get('/v3/company/:realm/query', (c) => {
  const query = c.req.query('query') ?? '';
  const match = query.match(/select \* from (\w+)(?: where (\w+) = '([^']*)')?/i);
  if (!match) return c.json(fault(`Unsupported query: ${query}`, '4000'), 400);
  const [, entity, field, value] = match;
  const books = company(c.req.param('realm'));
  const list = entity.toLowerCase() === 'vendor' ? books.vendors : entity.toLowerCase() === 'bill' ? books.bills : [];
  const rows = field ? list.filter((row) => String((row as unknown as Record<string, unknown>)[field]) === value) : list;
  return c.json({ QueryResponse: { [entity[0].toUpperCase() + entity.slice(1).toLowerCase()]: rows, startPosition: 1, maxResults: rows.length }, time: new Date().toISOString() });
});

app.post('/v3/company/:realm/vendor', async (c) => {
  const realm = c.req.param('realm');
  const body = await c.req.json<{ DisplayName?: string; PrimaryEmailAddr?: { Address: string } }>();
  if (!body.DisplayName) return c.json(fault('Required param missing: DisplayName'), 400);
  const books = company(realm);
  if (books.vendors.some((v) => v.DisplayName === body.DisplayName)) return c.json(fault('Duplicate Name Exists Error', '6240'), 400);
  const vendor: Vendor = { Id: nextId(), DisplayName: body.DisplayName, PrimaryEmailAddr: body.PrimaryEmailAddr, Balance: 0, MetaData: { CreateTime: new Date().toISOString() } };
  save(realm, { ...books, vendors: [...books.vendors, vendor] });
  return c.json({ Vendor: vendor, time: new Date().toISOString() });
});

app.post('/v3/company/:realm/bill', async (c) => {
  const realm = c.req.param('realm');
  const body = await c.req.json<{ VendorRef?: { value: string }; Line?: Array<{ Amount: number }>; DocNumber?: string; PrivateNote?: string }>();
  const books = company(realm);
  const vendor = books.vendors.find((v) => v.Id === body.VendorRef?.value);
  if (!vendor) return c.json(fault('Invalid Reference Id: VendorRef'), 400);
  if (!Array.isArray(body.Line) || !body.Line.length) return c.json(fault('Required param missing: Line'), 400);
  const total = Math.round(body.Line.reduce((s, l) => s + Number(l.Amount || 0), 0) * 100) / 100;
  const bill: Bill = { Id: nextId(), DocNumber: body.DocNumber ?? null, VendorRef: { value: vendor.Id, name: vendor.DisplayName }, TotalAmt: total, Balance: total, PrivateNote: body.PrivateNote ?? null, TxnDate: today() };
  save(realm, { ...books, bills: [...books.bills, bill], vendors: books.vendors.map((v) => (v.Id === vendor.Id ? { ...v, Balance: v.Balance + total } : v)) });
  return c.json({ Bill: bill, time: new Date().toISOString() });
});

app.post('/v3/company/:realm/billpayment', async (c) => {
  const realm = c.req.param('realm');
  const body = await c.req.json<{ TotalAmt?: number; Line?: Array<{ Amount: number; LinkedTxn: Array<{ TxnId: string }> }> }>();
  const books = company(realm);
  const billId = body.Line?.[0]?.LinkedTxn?.[0]?.TxnId;
  const bill = books.bills.find((b) => b.Id === billId);
  if (!bill) return c.json(fault('Invalid Reference Id: LinkedTxn'), 400);
  const amount = Number(body.TotalAmt ?? bill.Balance);
  const payment: Payment = { Id: nextId(), VendorRef: bill.VendorRef, TotalAmt: amount, BillId: bill.Id, TxnDate: today() };
  save(realm, {
    ...books, payments: [...books.payments, payment],
    bills: books.bills.map((b) => (b.Id === bill.Id ? { ...b, Balance: Math.max(0, Math.round((b.Balance - amount) * 100) / 100) } : b)),
    vendors: books.vendors.map((v) => (v.Id === bill.VendorRef.value ? { ...v, Balance: Math.round((v.Balance - amount) * 100) / 100 } : v)),
  });
  return c.json({ BillPayment: payment, time: new Date().toISOString() });
});

app.get('/__control/companies/:realm', (c) => c.json(company(c.req.param('realm'))));

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
app.get('/', (c) => {
  const companies = Object.entries(state.get().companies);
  const body = companies.length ? companies.map(([realm, books]) => `<div class="card" data-realm="${escapeHtml(realm)}"><h2 style="margin-top:0">Company ${escapeHtml(realm)}</h2>
<h3>Bills</h3><table><thead><tr><th>#</th><th>Vendor</th><th>Doc</th><th>Memo</th><th>Total</th><th>Open balance</th><th>Date</th></tr></thead><tbody>
${books.bills.map((b) => `<tr data-bill="${escapeHtml(b.DocNumber ?? b.Id)}"><td>${b.Id}</td><td>${escapeHtml(b.VendorRef.name)}</td><td>${escapeHtml(b.DocNumber ?? '')}</td><td>${escapeHtml(b.PrivateNote ?? '')}</td><td>${money(b.TotalAmt)}</td><td>${b.Balance === 0 ? '<b style="color:#15803d">Paid</b>' : money(b.Balance)}</td><td>${b.TxnDate}</td></tr>`).join('')}</tbody></table>
<h3>Payments</h3><table><tbody>${books.payments.map((p) => `<tr><td>${p.Id}</td><td>${escapeHtml(p.VendorRef.name)}</td><td>${money(p.TotalAmt)}</td><td>bill ${p.BillId}</td><td>${p.TxnDate}</td></tr>`).join('') || '<tr><td class="muted">none</td></tr>'}</tbody></table>
<h3>Vendors</h3><table><tbody>${books.vendors.map((v) => `<tr><td>${v.Id}</td><td>${escapeHtml(v.DisplayName)}</td><td>balance ${money(v.Balance)}</td></tr>`).join('')}</tbody></table></div>`).join('')
    : '<p class="muted">No company yet: bills appear here when a workflow records them.</p>';
  return c.html(page('QuickBooks Online (local fake)', `${body}<script>setTimeout(() => location.reload(), 3000)</script>`, '#2ca01c'));
});

service.start();
