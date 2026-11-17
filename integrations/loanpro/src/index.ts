import { createHmac, timingSafeEqual } from 'node:crypto';
import { createConnector, type Installation } from '@repo/connector-sdk';

/**
 * LoanPro connector (docs/plans/12): the loan servicing system of record once a deal is funded.
 *  - `loan.board`: customer + loan (setup, collateral) + activation; returns ids and the schedule; if the borrower is
 *    a client of the institution (`clientId`), their app gets the loan (`loans`, `payments` collections);
 *  - `payment.create`: a payment the borrower makes in the app;
 *  - `loan.get`: balance, next payment, days past due, payoff;
 *  - LoanPro webhooks (`payment.posted`, `loan.delinquent`, `loan.paid_off`) keep the borrower's app current and are
 *    published as `connector:loanpro/<event>`, starting servicing workflows (receipts, collections, title release)
 *    with the borrower as the applicant.
 * API shape and webhook signature are assumptions until checked against a sandbox: docs/ASSUMPTIONS.md.
 */
interface Settings { baseUrl: string; instanceId: string }

const DEFAULT_BASE_URL = process.env.LOANPRO_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://loanpro.simnang.com/api/public/api/1' : 'http://localhost:9410/api/public/api/1');
const round = (n: number) => Math.round(n * 100) / 100;

async function api<T = any>(installation: Installation, method: string, path: string, body?: unknown): Promise<T> {
  const settings = installation.config as unknown as Settings;
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/odata.svc${path}`, {
    method, signal: AbortSignal.timeout(20_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${(await installation.secrets.get('apiToken')) ?? ''}`, 'Autopal-Instance-Id': settings.instanceId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`LoanPro answered ${response.status}: ${text.slice(0, 300)}`);
  return (JSON.parse(text) as { d: T }).d;
}

interface LoanView {
  id: number; displayId: string; active: number;
  LoanSetup: { loanAmount: number; loanRate: number; loanTerm: number; payment: number; firstPaymentDate: string; maturityDate: string; contractDate: string };
  Collateral: Record<string, unknown>;
  StatusArchive: { results: Array<{ principalBalance: number; nextPaymentDate: string; nextPaymentAmount: number; daysPastDue: number; payoff: number; loanStatusText: string; loanSubStatusText: string }> };
  Payments: { results: Array<{ id: number; date: string; amount: number; principal: number; interest: number; balance: number; channel?: string }> };
}

/** What the borrower's app shows (collections `loans` and `payments`). */
function loanRecord(loan: LoanView) {
  const status = loan.StatusArchive.results[0];
  const vehicle = [loan.Collateral.year, loan.Collateral.make, loan.Collateral.model].filter(Boolean).join(' ');
  return {
    key: String(loan.displayId),
    data: {
      name: vehicle ? `Auto loan · ${vehicle}` : 'Auto loan', type: 'loan', loanId: loan.id, displayId: loan.displayId,
      amount: loan.LoanSetup.loanAmount, apr: loan.LoanSetup.loanRate, termMonths: loan.LoanSetup.loanTerm, payment: loan.LoanSetup.payment,
      balance: status?.principalBalance ?? loan.LoanSetup.loanAmount, nextPaymentDate: status?.nextPaymentDate ?? loan.LoanSetup.firstPaymentDate,
      nextPaymentAmount: status?.nextPaymentAmount ?? loan.LoanSetup.payment, daysPastDue: status?.daysPastDue ?? 0, payoff: status?.payoff ?? null,
      status: status?.loanStatusText ?? (loan.active ? 'Open' : 'Pending'), maturityDate: loan.LoanSetup.maturityDate, vin: loan.Collateral.vin ?? null, vehicle,
      currency: 'USD',
    },
  };
}
const paymentRecords = (loan: LoanView) => loan.Payments.results.map((p) => ({
  key: `pmt-${p.id}`,
  data: { loan: String(loan.displayId), date: p.date, amount: p.amount, principal: p.principal, interest: p.interest, balance: p.balance, description: p.channel === 'payoff' ? 'Payoff' : 'Loan payment', currency: 'USD', category: 'Loan payment' },
}));

/** Push the loan and its payments to the borrower's app (by client id, or by the LoanPro customer id). */
async function syncClient(installation: Installation, loan: LoanView, client: { id?: string; externalId?: string }) {
  await installation.core.clientRecords.write({ client: client.id ? { id: client.id } : { externalId: client.externalId, source: 'loanpro' }, collection: 'loans', records: [loanRecord(loan)] });
  const payments = paymentRecords(loan);
  if (payments.length) await installation.core.clientRecords.write({ client: client.id ? { id: client.id } : { externalId: client.externalId, source: 'loanpro' }, collection: 'payments', records: payments });
}

const connector = createConnector({
  manifest: {
    id: 'loanpro', version: '1.0.0', name: 'LoanPro', description: 'Board funded loans into LoanPro, take payments, and follow servicing events (payments, delinquency, payoff).',
    publisher: { name: 'Fintivio' }, categories: ['lending', 'servicing'], icon: 'Landmark', audiences: ['tenant'],
    scopes: ['installation:write', 'records:write', 'events:publish', 'client-records:write'],
    components: [
      {
        key: 'loan.board', version: 1, kind: 'action', title: 'Board a loan (LoanPro)', description: 'Creates the customer and the loan in LoanPro and activates it; the borrower sees it in their app.',
        icon: 'Landmark', category: 'data',
        configSchema: { type: 'object', properties: { loanClass: { type: 'string', title: 'Loan class', enum: ['car', 'consumer', 'other'], default: 'car' } } },
        inputSchema: {
          type: 'object', required: ['firstName', 'lastName', 'email', 'amount', 'apr', 'termMonths'],
          properties: {
            firstName: { type: 'string', title: 'First name' }, lastName: { type: 'string', title: 'Last name' }, email: { type: 'string', title: 'E-mail' }, phone: { type: 'string', title: 'Phone' },
            amount: { type: 'string', title: 'Amount financed' }, apr: { type: 'string', title: 'APR (%)' }, termMonths: { type: 'string', title: 'Term (months)' },
            firstPaymentDate: { type: 'string', title: 'First payment date (YYYY-MM-DD)' },
            vin: { type: 'string', title: 'VIN' }, year: { type: 'string', title: 'Year' }, make: { type: 'string', title: 'Make' }, model: { type: 'string', title: 'Model' },
            reference: { type: 'string', title: 'Loan id to show (display id)', description: 'e.g. = case.reference' },
            clientId: { type: 'string', title: 'Borrower (client id)', description: 'their app gets the loan, e.g. = steps.borrower.clientId' },
          },
        },
        defaults: { loanClass: 'car', input: { reference: '= case.reference' } },
        summary: 'Boards the loan in {{connection}}', events: ['boarded', 'failed'], invoke: { url: '', mode: 'sync' }, dataClasses: ['identity', 'financial'],
      },
      {
        key: 'payment.create', version: 1, kind: 'action', title: 'Take a loan payment (LoanPro)', description: 'Logs a payment on a LoanPro loan (e.g. from the borrower\'s app).',
        icon: 'HandCoins', category: 'data', configSchema: { type: 'object', properties: {} },
        inputSchema: { type: 'object', required: ['loanId', 'amount'], properties: { loanId: { type: 'string', title: 'LoanPro loan id' }, amount: { type: 'string', title: 'Amount' }, clientId: { type: 'string', title: 'Borrower (client id)' } } },
        summary: 'Payment via {{connection}}', events: ['posted', 'failed'], invoke: { url: '', mode: 'sync' }, dataClasses: ['financial'],
      },
      {
        key: 'loan.get', version: 1, kind: 'action', title: 'Loan status (LoanPro)', description: 'Balance, next payment, days past due and payoff amount of a loan.',
        icon: 'FileSearch', category: 'data', configSchema: { type: 'object', properties: {} },
        inputSchema: { type: 'object', required: ['loanId'], properties: { loanId: { type: 'string', title: 'LoanPro loan id' } } },
        summary: 'Loan status via {{connection}}', events: ['found', 'failed'], invoke: { url: '', mode: 'sync' }, dataClasses: ['financial'],
      },
    ],
    triggers: [
      { key: 'payment.posted', title: 'Payment posted', description: 'A payment was applied to a loan' },
      { key: 'loan.delinquent', title: 'Loan delinquent', description: 'A loan is past due' },
      { key: 'loan.paid_off', title: 'Loan paid off', description: 'A loan was paid in full' },
    ],
    egress: ['LoanPro (your tenant\'s API)'],
    dataHandling: { stores: ['API token and webhook secret (encrypted)', 'loan ids'], retention: 'deleted when the connection is removed', regions: [] },
  },
  settings: {
    intro: 'Use an API token of your LoanPro tenant (Settings → Company → API). Then add the webhook below in LoanPro.',
    fields: [
      { name: 'baseUrl', label: 'API base address', type: 'url', required: true, default: DEFAULT_BASE_URL },
      { name: 'instanceId', label: 'Tenant id (Autopal-Instance-Id)', required: true },
      { name: 'apiToken', label: 'API token', secret: true, required: true },
      { name: 'webhookSecret', label: 'Webhook secret', secret: true, required: true, help: 'the secret you set on the webhook in LoanPro' },
    ],
    async test(values, secrets, context) {
      const response = await fetch(`${String(values.baseUrl).replace(/\/+$/, '')}/odata.svc/Customers?$top=1`, { headers: { Authorization: `Bearer ${secrets.apiToken}`, 'Autopal-Instance-Id': String(values.instanceId) }, signal: AbortSignal.timeout(15_000) })
        .catch((e) => { throw new Error(`Could not reach LoanPro: ${e.message}`); });
      if (response.status === 401) throw new Error('LoanPro refused the API token');
      if (!response.ok) throw new Error(`LoanPro answered ${response.status}`);
      // Local fake only: register the webhook like an admin would in LoanPro's settings.
      if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)/.test(String(values.baseUrl))) {
        await fetch(new URL('/__control/webhooks', String(values.baseUrl)), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: values.instanceId, url: `${context.publicUrl}/webhooks/loanpro/${context.installationId}`, secret: secrets.webhookSecret }) }).catch(() => undefined);
      }
    },
    notes: (context) => [`Webhook URL to add in LoanPro (events: payment posted, loan delinquent, loan paid off): ${context.publicUrl}/webhooks/loanpro/${context.installationId}`],
    summary: (values) => ({ api: new URL(values.baseUrl).host, tenant: values.instanceId }),
    displayName: (values) => `LoanPro · ${values.instanceId}`,
  },
});

connector.action('loan.board', async ({ installation, config, input, log }) => {
  const amount = Number(input.amount);
  const apr = Number(input.apr);
  const term = Number(input.termMonths);
  if (!(amount > 0) || !(apr >= 0) || !(term > 0)) return { outcome: 'failed', output: { error: 'amount, apr and termMonths must be numbers' } };
  try {
    const customer = await api<{ id: number }>(installation, 'POST', '/Customers', { firstName: input.firstName, lastName: input.lastName, email: input.email, primaryPhone: input.phone || undefined, customId: input.reference || undefined });
    const created = await api<LoanView>(installation, 'POST', '/Loans', {
      displayId: String(input.reference || `L-${Date.now()}`),
      LoanSetup: { loanAmount: amount, loanRate: apr, loanTerm: term, contractDate: new Date().toISOString().slice(0, 10), ...(input.firstPaymentDate ? { firstPaymentDate: input.firstPaymentDate } : {}), loanClass: `loan.class.${config.loanClass || 'car'}`, paymentFrequency: 'loan.frequency.monthly' },
      Collateral: { vin: input.vin || undefined, year: input.year || undefined, make: input.make || undefined, model: input.model || undefined },
      Customers: { results: [{ __id: customer.id, customerRole: 'loan.customerRole.primary' }] },
    });
    const loan = await api<LoanView>(installation, 'PUT', `/Loans(${created.id})`, { LoanSetup: { active: 1 } });
    await installation.store.put(`loan:${loan.id}`, { customerId: customer.id, clientId: input.clientId || null, email: String(input.email).toLowerCase() });
    if (input.clientId) await syncClient(installation, loan, { id: String(input.clientId) });
    log.info('loan boarded', { installation: installation.id, loan: loan.id, customer: customer.id });
    return {
      outcome: 'boarded',
      output: {
        loanId: loan.id, displayId: loan.displayId, customerId: customer.id, payment: loan.LoanSetup.payment, firstPaymentDate: loan.LoanSetup.firstPaymentDate,
        maturityDate: loan.LoanSetup.maturityDate, balance: loan.StatusArchive.results[0]?.principalBalance ?? amount, status: loan.StatusArchive.results[0]?.loanStatusText ?? 'Open',
      },
    };
  } catch (error) {
    log.error('boarding failed', { installation: installation.id, error: (error as Error).message });
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
});

connector.action('payment.create', async ({ installation, input }) => {
  const amount = round(Number(input.amount));
  if (!(amount > 0)) return { outcome: 'failed', output: { error: 'amount must be positive' } };
  try {
    const result = await api<LoanView & { payment: { id: number; amount: number; principal: number; interest: number; balanceAfter: number } }>(installation, 'POST', `/Loans(${Number(input.loanId)})`, { Payments: { results: [{ amount, date: new Date().toISOString().slice(0, 10), paymentTypeId: 1, paymentMethodId: 'payment.method.ach' }] } });
    const stored = await installation.store.get<{ clientId: string | null; customerId: number }>(`loan:${input.loanId}`);
    const clientId = input.clientId || stored?.clientId;
    if (clientId) await syncClient(installation, result, { id: String(clientId) });
    return { outcome: 'posted', output: { paymentId: result.payment.id, amount: result.payment.amount, principal: result.payment.principal, interest: result.payment.interest, balance: result.payment.balanceAfter, status: result.StatusArchive.results[0]?.loanStatusText } };
  } catch (error) {
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
});

connector.action('loan.get', async ({ installation, input }) => {
  try {
    const loan = await api<LoanView>(installation, 'GET', `/Loans(${Number(input.loanId)})?$expand=LoanSetup,StatusArchive,Payments`);
    const status = loan.StatusArchive.results[0];
    return { outcome: 'found', output: { loanId: loan.id, displayId: loan.displayId, balance: status.principalBalance, nextPaymentDate: status.nextPaymentDate, nextPaymentAmount: status.nextPaymentAmount, daysPastDue: status.daysPastDue, payoff: status.payoff, status: status.loanStatusText, payment: loan.LoanSetup.payment } };
  } catch (error) {
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
});

/** LoanPro webhooks: verify, keep the borrower's app current, publish the servicing event. */
connector.app.post('/webhooks/loanpro/:installationId', async (c) => {
  const installation = await connector.installation(c.req.param('installationId'));
  if (!installation) return c.json({ error: 'unknown installation' }, 404);
  const secret = await installation.secrets.get('webhookSecret');
  const raw = await c.req.text();
  const given = (c.req.header('x-loanpro-signature') ?? '').replace(/^sha256=/, '');
  const expected = secret ? createHmac('sha256', secret).update(raw).digest('hex') : '';
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return c.json({ error: 'invalid signature' }, 401);
  const event = JSON.parse(raw) as { id: string; event: string; loanId: number; displayId: string; customerId: number; customerEmail?: string | null; payment?: Record<string, unknown>; daysPastDue?: number };
  if (!['payment.posted', 'loan.delinquent', 'loan.paid_off'].includes(event.event)) return c.json({ ignored: event.event });
  try {
    const stored = await installation.store.get<{ clientId: string | null; customerId: number; email: string }>(`loan:${event.loanId}`);
    const loan = await api<LoanView>(installation, 'GET', `/Loans(${event.loanId})?$expand=LoanSetup,StatusArchive,Payments`);
    await syncClient(installation, loan, stored?.clientId ? { id: stored.clientId } : { externalId: String(event.customerId) }).catch((e) => connector.log.error('client records not updated', { error: (e as Error).message }));
    const status = loan.StatusArchive.results[0];
    const result = await installation.core.events.publish({
      id: event.id, type: event.event, subject: loan.displayId, applicantEmail: stored?.email ?? event.customerEmail ?? undefined,
      data: {
        loanId: loan.id, displayId: loan.displayId, balance: status.principalBalance, nextPaymentDate: status.nextPaymentDate, nextPaymentAmount: status.nextPaymentAmount,
        daysPastDue: status.daysPastDue, payoff: status.payoff, status: status.loanStatusText, payment: event.payment ?? null,
      },
    });
    return c.json({ received: true, duplicate: result.duplicate, started: result.started.map((s) => s.reference) });
  } catch (error) {
    connector.log.error('loanpro webhook failed', { installation: installation.id, error: (error as Error).message });
    return c.json({ error: 'processing failed' }, 500);
  }
});

await connector.listen();
