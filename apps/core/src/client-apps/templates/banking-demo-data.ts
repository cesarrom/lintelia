import { and, eq } from 'drizzle-orm';
import { clientRecords } from '../../entities';
import type { TenantDatabase } from '../../clients/database.client';
import { updateProfile, writeRecord } from '../profiles';

/**
 * Sample data of an existing customer of the banking app (Demo Bank's Chris Client): profile, two accounts, about two
 * months of transactions with categories, a debit and a credit card, budgets. Dates are relative to today so the
 * insights are always "this month". Written once (kept if the client already has accounts).
 */
const MERCHANTS: Array<{ description: string; category: string; min: number; max: number; every: number }> = [
  { description: 'Tesco Superstore', category: 'Groceries', min: 18, max: 74, every: 4 },
  { description: 'Sainsbury’s Local', category: 'Groceries', min: 6, max: 22, every: 6 },
  { description: 'Pret A Manger', category: 'Dining out', min: 4, max: 12, every: 5 },
  { description: 'Dishoom', category: 'Dining out', min: 38, max: 72, every: 16 },
  { description: 'TfL Travel', category: 'Transport', min: 3, max: 9, every: 3 },
  { description: 'Uber', category: 'Transport', min: 9, max: 24, every: 12 },
  { description: 'Amazon', category: 'Shopping', min: 12, max: 65, every: 9 },
  { description: 'Netflix', category: 'Entertainment', min: 10.99, max: 10.99, every: 30 },
  { description: 'Spotify', category: 'Entertainment', min: 11.99, max: 11.99, every: 30 },
  { description: 'Boots', category: 'Health', min: 5, max: 28, every: 14 },
  { description: 'PureGym', category: 'Health', min: 24.99, max: 24.99, every: 30 },
];

/** Deterministic pseudo-random numbers (same data on every seed). */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function seedBankingCustomer(db: TenantDatabase, clientId: string, input: { name: string; externalId?: string }) {
  const [existing] = await db.select({ id: clientRecords.id }).from(clientRecords).where(and(eq(clientRecords.clientId, clientId), eq(clientRecords.collection, 'accounts'))).limit(1);
  if (existing) return false;

  await updateProfile(db, clientId, {
    attributes: {
      phone: '+44 7700 900123', dateOfBirth: '1988-04-12', address: '12 Harbour Street, Bristol BS1 4QA', employment: 'Employed full-time',
      marketing: 'No', kycLevel: 2, customerNumber: input.externalId ?? 'C-1001',
    },
    segments: ['registered', 'customer'],
    externalSource: 'api', externalId: input.externalId ?? 'C-1001',
  });

  const rand = random(42);
  const day = 86_400_000;
  const now = Date.now();
  const transactions: Array<{ key: string; data: Record<string, unknown> }> = [];
  let n = 0;
  for (let ago = 62; ago >= 0; ago--) {
    const date = new Date(now - ago * day - Math.floor(rand() * 8) * 3_600_000).toISOString();
    for (const merchant of MERCHANTS) {
      if ((ago + merchant.description.length) % merchant.every !== 0) continue;
      const amount = round(merchant.min + (merchant.max - merchant.min) * rand());
      transactions.push({ key: `tx-seed-${++n}`, data: { account: merchant.category === 'Entertainment' ? 'card-credit' : 'cur-1', date, description: merchant.description, amount: -amount, currency: 'GBP', category: merchant.category, status: 'posted' } });
    }
    const dayOfMonth = new Date(now - ago * day).getDate();
    if (dayOfMonth === 25) transactions.push({ key: `tx-seed-${++n}`, data: { account: 'cur-1', date, description: 'Salary · Northwind Ltd', amount: 3240, currency: 'GBP', category: 'Income', status: 'posted' } });
    if (dayOfMonth === 1) {
      transactions.push({ key: `tx-seed-${++n}`, data: { account: 'cur-1', date, description: 'Rent · Harbour Lettings', amount: -1150, currency: 'GBP', category: 'Bills', status: 'posted' } });
      transactions.push({ key: `tx-seed-${++n}`, data: { account: 'cur-1', date, description: 'Octopus Energy', amount: -86.4, currency: 'GBP', category: 'Bills', status: 'posted' } });
    }
    if (dayOfMonth === 26) transactions.push({ key: `tx-seed-${++n}`, data: { account: 'sav-1', date, description: 'Monthly saving', amount: 250, currency: 'GBP', category: 'Savings', status: 'posted' } });
  }

  const records: Array<{ collection: string; key: string; data: Record<string, unknown> }> = [
    { collection: 'accounts', key: 'cur-1', data: { name: 'Everyday account', type: 'current', number: '•• 4417', sortCode: '04-00-04', balance: 2418.32, currency: 'GBP', status: 'active', openedAt: '2021-03-02' } },
    { collection: 'accounts', key: 'sav-1', data: { name: 'Rainy day saver', type: 'savings', number: '•• 9021', sortCode: '04-00-04', balance: 8950, currency: 'GBP', rate: 3.1, status: 'active', openedAt: '2022-06-14' } },
    { collection: 'cards', key: 'card-debit', data: { name: 'Debit card', type: 'debit', network: 'visa', last4: '4821', account: 'cur-1', status: 'active', expiry: '09/29', holder: input.name } },
    { collection: 'cards', key: 'card-credit', data: { name: 'Credit card', type: 'credit', network: 'mastercard', last4: '9034', account: 'card-credit', status: 'active', expiry: '02/28', holder: input.name, limit: 3000, balance: 412.5 } },
    { collection: 'budgets', key: 'groceries', data: { category: 'Groceries', limit: 400 } },
    { collection: 'budgets', key: 'dining', data: { category: 'Dining out', limit: 150 } },
    { collection: 'budgets', key: 'transport', data: { category: 'Transport', limit: 120 } },
    { collection: 'budgets', key: 'shopping', data: { category: 'Shopping', limit: 200 } },
    ...transactions.map((t) => ({ collection: 'transactions', ...t })),
  ];
  for (const record of records) await writeRecord(db, { clientId, ...record, source: 'seed' });
  return true;
}
