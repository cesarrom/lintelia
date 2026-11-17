import { createFakeService, devPort, escapeHtml, hmacHex, jsonState, page } from '@repo/fake-kit';

/**
 * LoanPro (loan servicing), the subset of its OData API the LoanPro connector uses (assumptions:
 * integrations/loanpro/docs/ASSUMPTIONS.md). Under `/api/public/api/1/odata.svc`, with `Authorization: Bearer <token>`
 * and `Autopal-Instance-Id: <instance>`:
 *   POST /Customers                 create a customer
 *   POST /Loans                     create a loan (LoanSetup, Collateral, Customers)
 *   PUT  /Loans({id})               activate (`LoanSetup.active: 1`)
 *   GET  /Loans({id})               loan with LoanSetup, StatusArchive (balance, next payment, days past due), Payments
 *   POST /Loans({id})               log a payment (`Payments.results[]`)
 * Webhooks (what an admin configures in LoanPro): `payment.posted`, `loan.delinquent`, `loan.paid_off`, signed with
 * `X-LoanPro-Signature: sha256=<HMAC-SHA256 hex of the body>`.
 * `GET /` is the servicing screen (loans, payments) with buttons that act like the borrower or the servicer (a payment
 * through the servicer's own channel, a missed payment, a payoff). Control: `/__control/webhooks`, `/__control/loans/*`.
 */
interface Payment { id: number; date: string; amount: number; principal: number; interest: number; balanceAfter: number; channel: string }
interface Loan {
  id: number; instance: string; displayId: string; customerId: number; active: boolean; status: 'Pending' | 'Open' | 'Delinquent' | 'Paid Off';
  setup: { loanAmount: number; loanRate: number; loanTerm: number; contractDate: string; firstPaymentDate: string; payment: number; maturityDate: string };
  collateral: Record<string, unknown>; balance: number; nextPaymentDate: string; daysPastDue: number; payments: Payment[]; createdAt: string;
}
interface Customer { id: number; instance: string; firstName: string; lastName: string; email: string; phone: string | null; customId: string | null }

const port = devPort('loanpro', 9410);
const base = '/api/public/api/1/odata.svc';
const service = createFakeService({ name: 'loanpro', port, recordPaths: (p) => p.startsWith('/api/') });
const state = jsonState<{ customers: Customer[]; loans: Loan[]; webhooks: Record<string, { url: string; secret: string }>; next: number }>('loanpro', 'state.json', { customers: [], loans: [], webhooks: {}, next: 1000 });
service.onReset(() => state.set({ customers: [], loans: [], webhooks: {}, next: 1000 }));
const app = service.app;

const round = (n: number) => Math.round(n * 100) / 100;
const id = () => {
  const current = state.get();
  state.set({ ...current, next: current.next + 1 });
  return current.next + 1;
};
const addMonths = (date: string, months: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const monthlyPayment = (amount: number, apr: number, term: number) => {
  const r = apr / 100 / 12;
  return round(r === 0 ? amount / term : (amount * r) / (1 - (1 + r) ** -term));
};
const saveLoan = (loan: Loan) => {
  const current = state.get();
  state.set({ ...current, loans: current.loans.map((l) => (l.id === loan.id ? loan : l)) });
};
const instanceOf = (c: { req: { header(n: string): string | undefined } }) => c.req.header('autopal-instance-id') ?? '';
const error = (message: string, status = 400) => ({ error: { message, type: status === 401 ? 'UnauthorizedException' : 'BadRequestException', code: status } });

function statusView(loan: Loan) {
  const payoff = payoffAmount(loan);
  return {
    principalBalance: loan.balance, amountDue: loan.daysPastDue > 0 ? loan.setup.payment : 0, nextPaymentDate: loan.nextPaymentDate,
    nextPaymentAmount: Math.min(loan.setup.payment, loan.balance), daysPastDue: loan.daysPastDue, payoff: loan.balance > 0 ? payoff : 0,
    loanStatusText: loan.status, loanSubStatusText: loan.daysPastDue > 0 ? `${loan.daysPastDue} days past due` : 'Current',
  };
}
const loanView = (loan: Loan) => ({
  id: loan.id, displayId: loan.displayId, active: loan.active ? 1 : 0,
  LoanSetup: { ...loan.setup, active: loan.active ? 1 : 0 }, Collateral: loan.collateral,
  StatusArchive: { results: [statusView(loan)] }, Customers: { results: [{ id: loan.customerId }] },
  Payments: { results: loan.payments.map((p) => ({ id: p.id, date: p.date, amount: p.amount, principal: p.principal, interest: p.interest, balance: p.balanceAfter, channel: p.channel })) },
});

async function webhook(loan: Loan, event: string, extra: Record<string, unknown> = {}) {
  const hook = state.get().webhooks[loan.instance];
  if (!hook) return;
  const customer = state.get().customers.find((c) => c.id === loan.customerId);
  const body = JSON.stringify({ id: `evt_${id()}`, event, createdAt: new Date().toISOString(), loanId: loan.id, displayId: loan.displayId, customerId: loan.customerId, customerEmail: customer?.email ?? null, status: statusView(loan), ...extra });
  await fetch(hook.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LoanPro-Signature': `sha256=${hmacHex(hook.secret, body)}` }, body, signal: AbortSignal.timeout(10_000) })
    .then(async (r) => { if (!r.ok) console.warn(`[loanpro] webhook ${event} answered ${r.status}: ${(await r.text()).slice(0, 200)}`); })
    .catch((e) => console.warn(`[loanpro] webhook ${event} failed: ${e.message}`));
}

/** Interest accrued since the last payment: 10 days (the payoff quote uses the same), a month for a scheduled payment. */
const payoffAmount = (loan: Loan) => round(loan.balance + loan.balance * (loan.setup.loanRate / 100 / 365) * 10);

function applyPayment(loan: Loan, amount: number, channel: string): Payment {
  // Enough to pay the loan off (the payoff quote): it is paid in full.
  const full = amount >= payoffAmount(loan);
  const interest = full ? round(payoffAmount(loan) - loan.balance) : round(loan.balance * (loan.setup.loanRate / 100 / 12));
  const principal = full ? loan.balance : round(Math.min(loan.balance, Math.max(0, amount - interest)));
  loan.balance = round(loan.balance - principal);
  const payment: Payment = { id: id(), date: new Date().toISOString().slice(0, 10), amount: round(amount), principal, interest: round(amount - principal), balanceAfter: loan.balance, channel };
  loan.payments.push(payment);
  loan.daysPastDue = 0;
  loan.nextPaymentDate = addMonths(loan.nextPaymentDate, 1);
  loan.status = loan.balance <= 0 ? 'Paid Off' : 'Open';
  if (loan.balance <= 0) loan.active = false;
  saveLoan(loan);
  return payment;
}

app.use(`${base}/*`, async (c, next) => {
  if (!/^Bearer\s+\S+/.test(c.req.header('authorization') ?? '') || /invalid$/.test(c.req.header('authorization') ?? '')) return c.json(error('Unauthorized', 401), 401);
  if (!instanceOf(c)) return c.json(error('Missing Autopal-Instance-Id header'), 400);
  await next();
});

app.post(`${base}/Customers`, async (c) => {
  const body = await c.req.json<{ firstName?: string; lastName?: string; email?: string; primaryPhone?: string; customId?: string }>();
  if (!body.firstName || !body.lastName || !body.email) return c.json(error('firstName, lastName and email are required'), 400);
  const customer: Customer = { id: id(), instance: instanceOf(c), firstName: body.firstName, lastName: body.lastName, email: body.email.toLowerCase(), phone: body.primaryPhone ?? null, customId: body.customId ?? null };
  state.set({ ...state.get(), customers: [...state.get().customers, customer] });
  return c.json({ d: customer });
});

app.get(`${base}/Customers`, (c) => {
  const email = (c.req.query('$filter') ?? '').match(/email eq '([^']+)'/)?.[1]?.toLowerCase();
  return c.json({ d: { results: state.get().customers.filter((x) => x.instance === instanceOf(c) && (!email || x.email === email)) } });
});

app.post(`${base}/Loans`, async (c) => {
  const body = await c.req.json<{ displayId?: string; LoanSetup?: Record<string, unknown>; Collateral?: Record<string, unknown>; Customers?: { results?: Array<{ __id?: number }> } }>();
  const setup = body.LoanSetup ?? {};
  const amount = Number(setup.loanAmount);
  const rate = Number(setup.loanRate);
  const term = Number(setup.loanTerm);
  const customerId = Number(body.Customers?.results?.[0]?.__id);
  if (!(amount > 0) || !(rate >= 0) || !(term > 0)) return c.json(error('LoanSetup.loanAmount, loanRate and loanTerm are required'), 400);
  if (!state.get().customers.some((x) => x.id === customerId && x.instance === instanceOf(c))) return c.json(error('Customers: unknown customer'), 400);
  const contractDate = String(setup.contractDate ?? new Date().toISOString().slice(0, 10));
  const firstPaymentDate = String(setup.firstPaymentDate ?? addMonths(contractDate, 1));
  const loan: Loan = {
    id: id(), instance: instanceOf(c), displayId: String(body.displayId ?? `L-${Date.now()}`), customerId, active: false, status: 'Pending',
    setup: { loanAmount: amount, loanRate: rate, loanTerm: term, contractDate, firstPaymentDate, payment: monthlyPayment(amount, rate, term), maturityDate: addMonths(firstPaymentDate, term - 1) },
    collateral: body.Collateral ?? {}, balance: amount, nextPaymentDate: firstPaymentDate, daysPastDue: 0, payments: [], createdAt: new Date().toISOString(),
  };
  state.set({ ...state.get(), loans: [...state.get().loans, loan] });
  return c.json({ d: loanView(loan) });
});

const loanParam = (value: string) => Number(value.replace(/\D/g, ''));
const findLoan = (c: { req: { param(n: string): string } }, instance: string) => state.get().loans.find((l) => l.id === loanParam(c.req.param('key')) && l.instance === instance);

app.get(`${base}/:key{Loans\\(\\d+\\)}`, (c) => {
  const loan = findLoan(c, instanceOf(c));
  return loan ? c.json({ d: loanView(loan) }) : c.json(error('Loan not found', 404), 404);
});

app.put(`${base}/:key{Loans\\(\\d+\\)}`, async (c) => {
  const loan = findLoan(c, instanceOf(c));
  if (!loan) return c.json(error('Loan not found', 404), 404);
  const body = await c.req.json<{ LoanSetup?: { active?: number } }>();
  if (body.LoanSetup?.active === 1 && !loan.active) {
    loan.active = true;
    loan.status = 'Open';
    saveLoan(loan);
  }
  return c.json({ d: loanView(loan) });
});

app.post(`${base}/:key{Loans\\(\\d+\\)}`, async (c) => {
  const loan = findLoan(c, instanceOf(c));
  if (!loan) return c.json(error('Loan not found', 404), 404);
  if (!loan.active) return c.json(error('The loan is not active'), 400);
  const body = await c.req.json<{ Payments?: { results?: Array<{ amount?: number }> } }>();
  const amount = Number(body.Payments?.results?.[0]?.amount);
  if (!(amount > 0)) return c.json(error('Payments.results[0].amount is required'), 400);
  const payment = applyPayment(loan, Math.min(amount, round(loan.balance * 1.05 + 1)), 'api');
  void webhook(loan, loan.status === 'Paid Off' ? 'loan.paid_off' : 'payment.posted', { payment });
  return c.json({ d: { ...loanView(loan), payment } });
});

// --- control (the servicer's own channels) ------------------------------------------------------------------------------

app.post('/__control/webhooks', async (c) => {
  const { instanceId, url, secret } = await c.req.json<{ instanceId: string; url: string; secret: string }>();
  state.set({ ...state.get(), webhooks: { ...state.get().webhooks, [instanceId]: { url, secret } } });
  return c.json({ instanceId, url });
});

const controlLoan = (value: string) => state.get().loans.find((l) => l.id === Number(value) || l.displayId === value);
const redirectOrJson = (c: { req: { header(n: string): string | undefined }; redirect(u: string, s?: number): Response; json(b: unknown): Response }, body: unknown) =>
  (c.req.header('content-type') ?? '').includes('form') ? c.redirect('/', 303) : c.json(body);

app.post('/__control/loans/:id/pay', async (c) => {
  const loan = controlLoan(c.req.param('id'));
  if (!loan?.active) return c.json({ error: 'no active loan' }, 404);
  const form = (c.req.header('content-type') ?? '').includes('form') ? await c.req.parseBody() : await c.req.json().catch(() => ({}));
  const amount = Number((form as Record<string, unknown>).amount) || loan.setup.payment;
  const payment = applyPayment(loan, amount, 'ach');
  await webhook(loan, loan.status === 'Paid Off' ? 'loan.paid_off' : 'payment.posted', { payment });
  return redirectOrJson(c, { loan: loanView(loan), payment });
});

app.post('/__control/loans/:id/delinquent', async (c) => {
  const loan = controlLoan(c.req.param('id'));
  if (!loan?.active) return c.json({ error: 'no active loan' }, 404);
  const form = (c.req.header('content-type') ?? '').includes('form') ? await c.req.parseBody() : await c.req.json().catch(() => ({}));
  loan.daysPastDue = Number((form as Record<string, unknown>).daysPastDue) || 15;
  loan.status = 'Delinquent';
  saveLoan(loan);
  await webhook(loan, 'loan.delinquent', { daysPastDue: loan.daysPastDue });
  return redirectOrJson(c, { loan: loanView(loan) });
});

app.post('/__control/loans/:id/payoff', async (c) => {
  const loan = controlLoan(c.req.param('id'));
  if (!loan?.active) return c.json({ error: 'no active loan' }, 404);
  const payment = applyPayment(loan, payoffAmount(loan), 'payoff');
  await webhook(loan, 'loan.paid_off', { payment });
  return redirectOrJson(c, { loan: loanView(loan), payment });
});

app.get('/__control/loans', (c) => c.json(state.get().loans.map(loanView)));

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
app.get('/', (c) => {
  const { loans, customers } = state.get();
  const rows = [...loans].reverse().map((loan) => {
    const customer = customers.find((x) => x.id === loan.customerId);
    const vehicle = [loan.collateral.year, loan.collateral.make, loan.collateral.model].filter(Boolean).join(' ');
    return `<div class="card" data-loan="${escapeHtml(loan.displayId)}" data-status="${escapeHtml(loan.status)}">
<h2 style="margin:0 0 4px">${escapeHtml(loan.displayId)} · ${escapeHtml(customer ? `${customer.firstName} ${customer.lastName}` : loan.customerId)} <span class="muted">${escapeHtml(loan.status)}${loan.daysPastDue ? ` · ${loan.daysPastDue} days past due` : ''}</span></h2>
<p class="muted">${escapeHtml(vehicle)} ${escapeHtml(loan.collateral.vin ?? '')} · ${money(loan.setup.loanAmount)} at ${loan.setup.loanRate}% over ${loan.setup.loanTerm} months · payment ${money(loan.setup.payment)} · first due ${loan.setup.firstPaymentDate}</p>
<p>Balance <b data-testid="balance">${money(loan.balance)}</b> · next payment ${loan.nextPaymentDate}</p>
${loan.active ? `<form method="post" action="/__control/loans/${loan.id}/pay" style="display:inline"><input name="amount" value="${loan.setup.payment}" size="8"> <button>Post a payment</button></form>
<form method="post" action="/__control/loans/${loan.id}/delinquent" style="display:inline"><input type="hidden" name="daysPastDue" value="15"><button class="secondary">Missed payment</button></form>
<form method="post" action="/__control/loans/${loan.id}/payoff" style="display:inline"><button class="secondary">Pay off</button></form>` : ''}
${loan.payments.length ? `<table style="margin-top:10px"><thead><tr><th>Date</th><th>Amount</th><th>Principal</th><th>Interest</th><th>Balance</th><th>Channel</th></tr></thead><tbody>${loan.payments.map((p) => `<tr><td>${p.date}</td><td>${money(p.amount)}</td><td>${money(p.principal)}</td><td>${money(p.interest)}</td><td>${money(p.balanceAfter)}</td><td>${p.channel}</td></tr>`).join('')}</tbody></table>` : ''}
</div>`;
  }).join('');
  return c.html(page('LoanPro servicing (local fake)', `${rows || '<p class="muted">No loans yet: they appear here when deals are boarded.</p>'}<script>setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) location.reload(); }, 4000)</script>`, '#1e3a8a'));
});

service.start();
