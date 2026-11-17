import { ordered } from '@repo/fintivio/schemas';
import { evaluate } from './expressions';
import type { AppData, AppDefinition, Me } from './types';

/**
 * Sample data for the studio's preview (no real client involved): a sample client, records for every collection of the
 * app (realistic banking data for the banking collections, generated values otherwise), a few applications and
 * notifications. Journeys are those a client with this profile may start (eligibility evaluated here).
 */
const DAY = 86_400_000;

function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

const MERCHANTS = [
  { description: 'Tesco Superstore', category: 'Groceries', min: 18, max: 74, every: 4 },
  { description: 'Pret A Manger', category: 'Dining out', min: 4, max: 12, every: 5 },
  { description: 'TfL Travel', category: 'Transport', min: 3, max: 9, every: 3 },
  { description: 'Amazon', category: 'Shopping', min: 12, max: 65, every: 9 },
  { description: 'Netflix', category: 'Entertainment', min: 10.99, max: 10.99, every: 30 },
  { description: 'PureGym', category: 'Health', min: 24.99, max: 24.99, every: 30 },
];

function bankingRecords(collection: string, holder: string): Array<Record<string, unknown> & { key: string }> | null {
  const rand = random(7);
  const now = Date.now();
  switch (collection) {
    case 'accounts':
      return [
        { key: 'cur-1', name: 'Everyday account', type: 'current', number: '•• 4417', sortCode: '04-00-04', balance: 2418.32, currency: 'GBP', status: 'active', openedAt: '2021-03-02' },
        { key: 'sav-1', name: 'Rainy day saver', type: 'savings', number: '•• 9021', sortCode: '04-00-04', balance: 8950, currency: 'GBP', rate: 3.1, status: 'active', openedAt: '2022-06-14' },
      ];
    case 'cards':
      return [
        { key: 'card-debit', name: 'Debit card', type: 'debit', network: 'visa', last4: '4821', account: 'cur-1', status: 'active', expiry: '09/29', holder },
        { key: 'card-credit', name: 'Credit card', type: 'credit', network: 'mastercard', last4: '9034', status: 'active', expiry: '02/28', holder, limit: 3000, balance: 412.5 },
      ];
    case 'budgets':
      return [
        { key: 'groceries', category: 'Groceries', limit: 400 },
        { key: 'dining', category: 'Dining out', limit: 150 },
        { key: 'transport', category: 'Transport', limit: 120 },
      ];
    case 'transactions': {
      const list: Array<Record<string, unknown> & { key: string }> = [];
      let n = 0;
      for (let ago = 34; ago >= 0; ago--) {
        const date = new Date(now - ago * DAY - Math.floor(rand() * 8) * 3_600_000).toISOString();
        for (const m of MERCHANTS) {
          if ((ago + m.description.length) % m.every !== 0) continue;
          list.push({ key: `tx-${++n}`, account: 'cur-1', date, description: m.description, amount: -round(m.min + (m.max - m.min) * rand()), currency: 'GBP', category: m.category, status: 'posted' });
        }
        if (ago === 6) list.push({ key: `tx-${++n}`, account: 'cur-1', date, description: 'Salary · Northwind Ltd', amount: 3240, currency: 'GBP', category: 'Income', status: 'posted' });
        if (ago === 20) list.push({ key: `tx-${++n}`, account: 'cur-1', date, description: 'Rent · Harbour Lettings', amount: -1150, currency: 'GBP', category: 'Bills', status: 'posted' });
      }
      return list;
    }
    default:
      return null;
  }
}

function generated(collection: AppDefinition['collections'][number]): Array<Record<string, unknown> & { key: string }> {
  return [1, 2, 3].map((i) => {
    const item: Record<string, unknown> & { key: string } = { key: `${collection.key}-${i}` };
    for (const field of collection.fields) {
      item[field.key] = field.type === 'number' ? i * 10 : field.type === 'money' ? round(125.5 * i) : field.type === 'date' ? new Date(Date.now() - i * DAY).toISOString()
        : field.type === 'boolean' ? i % 2 === 1 : `${field.label} ${i}`;
    }
    if (!collection.fields.some((f) => f.key === 'name')) item.name = `${collection.label} ${i}`;
    return item;
  });
}

export function sampleMe(definition: AppDefinition): Me {
  const attributes: Record<string, unknown> = {};
  for (const field of definition.profile?.fields ?? []) {
    attributes[field.key] = field.type === 'date' ? '1990-05-17' : field.type === 'phone' ? '+44 7700 900456' : field.type === 'email' ? 'alex.morgan@example.com'
      : field.type === 'number' ? 2 : field.type === 'select' ? field.options?.[0] ?? '' : field.type === 'textarea' ? '1 Sample Street, London' : field.key === 'customerNumber' ? 'C-0001' : `Sample ${field.label.toLowerCase()}`;
  }
  return {
    ...attributes, id: 'sample', email: 'alex.morgan@example.com', name: 'Alex Morgan', firstName: 'Alex', lastName: 'Morgan', externalId: 'C-0001',
    segments: ['registered', 'customer'], attributes, consents: (definition.registration?.consents ?? []).map((c) => ({ key: c.key, version: c.version, acceptedAt: new Date(Date.now() - 40 * DAY).toISOString() })),
    since: new Date(Date.now() - 400 * DAY).toISOString(),
  };
}

export async function sampleData(definition: AppDefinition, me: Me = sampleMe(definition)): Promise<AppData> {
  const records: AppData['records'] = {};
  for (const collection of definition.collections ?? []) records[collection.key] = bankingRecords(collection.key, me.name) ?? generated(collection);
  const journeys = [];
  for (const [key, journey] of ordered(definition.journeys ?? {}, definition.journeyOrder)) {
    if (journey.hidden) continue;
    if (journey.eligibility?.trim() && !(await evaluate(journey.eligibility, me, {}))) continue;
    journeys.push({ key, title: journey.title, description: journey.description ?? null, icon: journey.icon ?? null, category: journey.category ?? null });
  }
  const visible = ordered(definition.journeys ?? {}, definition.journeyOrder).filter(([, j]) => !j.hidden);
  const now = Date.now();
  const cases = visible.slice(0, 2).map(([key, j], i) => ({
    id: `sample-case-${i}`, reference: `C-2026-SAMPL${i}`, title: j.title, status: i === 0 ? 'in_review' : 'completed', statusLabel: i === 0 ? 'Under review' : 'Completed',
    journey: key, icon: j.icon ?? null, stage: i === 0 ? (j.stages.at(-2)?.label ?? null) : null, waitingForMe: false, final: i !== 0, progress: i === 0 ? 75 : 100,
    createdAt: new Date(now - (i + 1) * 3 * DAY).toISOString(), updatedAt: new Date(now - (i + 1) * DAY).toISOString(),
  }));
  return {
    me, records, journeys, cases, requests: [],
    notifications: [
      { id: 'n1', title: 'Welcome aboard', body: 'Your sign-in is ready.', tone: 'success', link: null, read: false, createdAt: new Date(now - 2 * 3_600_000).toISOString() },
      { id: 'n2', title: 'Your statement is ready', body: 'See everything that moved last month.', tone: 'info', link: null, read: true, createdAt: new Date(now - 5 * DAY).toISOString() },
    ],
  };
}
