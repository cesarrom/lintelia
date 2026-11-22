import { expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { Api, expectStatus } from './api';
import { appClient, startJourney, submitScreen, systemApi, waitForJourney } from './client-app';
import { env } from './env';
import { fakeRecords, requireFake } from './fakes';
import { decide, prepareInstitution, waitForTask, type Institution } from './scenario';
import { documentPdf, uploadForRequest } from './uploads';

/**
 * Dealer finance (docs/plans/12): an institution with underwriting and funding teams, connections to the AI model,
 * LoanPro, Documenso, Google Sheets and QuickBooks (local fakes), and the "Dealer & borrower portal" template installed
 * and published. Every institution gets its own spreadsheet and QuickBooks company, so files can run in parallel.
 */
export interface DealerFinance {
  inst: Institution;
  spreadsheetId: string;
  realm: string;
  /** Journey key → workflow id. */
  journeys: Record<string, string>;
  designer: Api;
  underwriter: Api;
  funder: Api;
}

export const DEALER_FEE = 395;

export async function prepareDealerFinance(): Promise<DealerFinance> {
  for (const fake of ['llm', 'loanpro', 'documenso', 'sheets', 'quickbooks'] as const) await requireFake(fake);
  const inst = await prepareInstitution({
    members: { designer: 'flow_designer', underwriter: 'reviewer', funder: 'senior_reviewer' },
    connections: ['ai', 'loanpro', 'documenso', 'sheets', 'quickbooks'],
  });
  const designer = Api.as(inst.members.designer);
  const spreadsheetId = `deal-log-${randomBytes(4).toString('hex')}`;
  const realm = String(9_130_000_000 + Math.floor(Math.random() * 1e9));
  const installed = await designer.post('/client-apps/current/template', {
    template: 'dealer-finance',
    connections: { AI: inst.connections.ai, LOANPRO: inst.connections.loanpro, DOCUMENSO: inst.connections.documenso, SHEETS: inst.connections.sheets, QUICKBOOKS: inst.connections.quickbooks },
    parameters: { SPREADSHEET_ID: spreadsheetId, QBO_REALM: realm, DEALER_FEE: String(DEALER_FEE) },
  });
  expectStatus(installed, 200);
  expect(installed.body.errors).toEqual([]);
  expectStatus(await designer.post('/client-apps/current/publish'), 200);
  const journeys = Object.fromEntries(Object.entries(installed.body.draft.journeys as Record<string, { workflowId: string }>).map(([k, j]) => [k, j.workflowId]));
  return { inst, spreadsheetId, realm, journeys, designer, underwriter: Api.as(inst.members.underwriter), funder: Api.as(inst.members.funder) };
}

export interface Deal {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  year: number;
  make: string;
  model: string;
  vin: string;
  salePrice: number;
  downPayment: number;
  amountFinanced: number;
  termMonths: string;
  apr: number;
  statedIncome: number;
}

const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
export const randomVin = () => `1HG${Array.from(randomBytes(14), (b) => VIN_CHARS[b % VIN_CHARS.length]).join('')}`;

export function sampleDeal(overrides: Partial<Deal> = {}): Deal {
  const tag = randomBytes(3).toString('hex');
  return {
    buyerName: 'Jamie Rivera', buyerEmail: `jamie.${tag}@buyers.example`, buyerPhone: '+1 512 555 0142',
    year: 2022, make: 'Honda', model: 'Accord', vin: randomVin(),
    salePrice: 24_500, downPayment: 3_500, amountFinanced: 21_000, termMonths: '60', apr: 8.9, statedIncome: 5_500,
    ...overrides,
  };
}

/** The stipulations as the dealer scans them: digital documents whose text the AI reads. */
export async function dealDocuments(deal: Deal, opts: { income?: number | null; vin?: string } = {}) {
  const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  return {
    // `income: null`: a pay stub without the figure (a bad scan): the AI reports it missing.
    payStub: await documentPdf(['Pay stub - October 2026', 'Employer: Northwind Logistics', `Employee name: ${deal.buyerName}`, 'Pay date: 2026-10-31', ...(opts.income === null ? [] : [`Gross monthly income: ${usd(opts.income ?? 5_400)}`])]),
    buyersOrder: await documentPdf(["Buyer's order - Sunrise Motors", `Buyer name: ${deal.buyerName}`, `Vehicle: ${deal.year} ${deal.make} ${deal.model}`, `VIN: ${opts.vin ?? deal.vin}`, `Sale price: ${usd(deal.salePrice)}`, `Down payment: ${usd(deal.downPayment)}`, `Amount financed: ${usd(deal.amountFinanced)}`]),
    license: await documentPdf(['Driver license - State of Texas', `Name: ${deal.buyerName}`, 'License number: 40917733', 'Expires: 2030-05-01']),
  };
}

/** A dealership's user: signs up on the portal and is made a dealer by the institution's systems. */
export async function dealerUser(df: DealerFinance, dealerName = 'Sunrise Motors') {
  const dealer = await appClient(df.inst.bank, { name: 'Dana Dealer', phone: '+1 512 555 0100' });
  const system = await systemApi(df.inst.bank, ['clients:provision', 'clients:records'], 'Dealer management');
  expectStatus(await system.patch(`/clients/${dealer.user.userId}/profile`, { addSegments: ['dealer'], attributes: { dealerName } }), 200);
  return dealer;
}

/** The dealer submits a deal with its stipulations through the API (what the portal does). Returns the journey state. */
export async function submitDeal(me: Api, deal: Deal, docs?: Awaited<ReturnType<typeof dealDocuments>>) {
  let state = await startJourney(me, 'submit_deal');
  expect(state.screen.stage).toBe('submitted');
  const { buyerName, buyerEmail, buyerPhone, year, make, model, vin, salePrice, downPayment, amountFinanced, termMonths, apr, statedIncome } = deal;
  const res = await submitScreen(me, state, 'continue', { dealerName: state.screen.values.dealerName, buyerName, buyerEmail, buyerPhone, year, make, model, vin, salePrice, downPayment, amountFinanced, termMonths, apr, statedIncome });
  expectStatus(res, [200, 201]);
  state = res.body.screen?.stage === 'documents' ? res.body : await waitForJourney(me, state.case.id, (s) => s.screen?.stage === 'documents');
  const files = docs ?? await dealDocuments(deal);
  const ids: Record<string, string[]> = {};
  for (const [key, bytes] of Object.entries(files)) {
    const upload = await uploadForRequest(me, { taskId: state.screen.taskId, itemKey: key, name: `${key}.pdf`, type: 'application/pdf', bytes });
    expect(upload.outcome?.status, `${key} upload`).toBe('available');
    ids[key] = [upload.outcome!.fileId!];
  }
  expectStatus(await submitScreen(me, state, 'submit', ids), [200, 201]);
  return state.case as { id: string; reference: string };
}

/** Rows of the deal log spreadsheet (fake Google Sheets). */
export async function dealLog(spreadsheetId: string): Promise<string[][]> {
  const sheet = await fakeRecords<{ rows: string[][] } | null>('sheets', `/spreadsheets/${spreadsheetId}`);
  return sheet?.rows ?? [];
}

/** The QuickBooks company of the institution (fake): vendors, bills, bill payments. */
export const quickbooksCompany = (realm: string) => fakeRecords<{ vendors: any[]; bills: any[]; payments: any[] }>('quickbooks', `/companies/${realm}`);

/** Loans in the LoanPro fake (all tenants). */
export const loanproLoans = () => fakeRecords<any[]>('loanpro', '/loans');

/** A LoanPro back-office action on a loan (post a payment, mark it past due, pay it off): LoanPro sends its webhooks. */
export async function loanproAction(loanId: number, action: 'pay' | 'delinquent' | 'payoff', body: Record<string, unknown> = {}) {
  const res = await fetch(`${env.fakes.loanpro}/__control/loans/${loanId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.ok, `loanpro ${action}`).toBe(true);
  return res.json();
}

/** The reviewer (any queue member) takes the case's task and decides it. */
export async function decideDeal(api: Api, caseId: string, outcome: string, reason?: string, extra: Record<string, unknown> = {}) {
  const task = await waitForTask(api, caseId, { timeoutMs: 60_000 });
  if (!task.assigneeId) expectStatus(await api.post(`/tasks/${task.id}/claim`), 200);
  expectStatus(await decide(api, task.id, outcome as 'approve', reason, extra), 200);
  return task;
}
