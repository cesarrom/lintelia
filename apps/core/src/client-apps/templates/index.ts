import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, max } from 'drizzle-orm';
import { BLANK_CLIENT_APP, clientAppDefinitionSchema, withKeyOrder, type ClientAppDefinition } from '@repo/lintelia/schemas';
import { clientApps, clientAppVersions, sysWorkflows, workflowVersions } from '../../entities';
import type { TenantDatabase } from '../../clients/database.client';
import { parseDefinition } from '../../engine/definition';
import { DEALER_FINANCE_PARAMETERS, DEALER_FINANCE_REQUIRES, dealerFinanceApp, dealerFinanceValues, installDealerFinanceWorkflows, type DealerFinanceInput } from '../../solutions/dealer-finance';

/**
 * Ready-made client apps (docs/plans/11). "Banking app" is the reference: a customer banking / money-management app
 * with its journeys as workflows (templates/banking/*.yaml).
 */
export const CLIENT_APP_TEMPLATES = [
  {
    id: 'banking', name: 'Banking app', category: 'Retail banking',
    description: 'Balances, accounts and transactions, cards (freeze, report lost), insights and budgets, move money, savings, personal loans, onboarding with KYC review, address changes, secure messages.',
  },
  {
    id: 'dealer-finance', name: 'Dealer & borrower portal', category: 'Auto finance',
    description: 'Indirect auto lending: dealers submit deals with stipulations (read by AI), underwriting asks for more as often as needed, contracts are signed, dealers are funded (QuickBooks) and loans boarded (LoanPro); borrowers pay and follow their loan.',
    requires: DEALER_FINANCE_REQUIRES, parameters: DEALER_FINANCE_PARAMETERS,
  },
  { id: 'blank', name: 'Blank app', category: 'Start from scratch', description: 'A home page, an activity page and a profile page to build on.' },
] as const;

/** Journey key → workflow file. `welcome` is not a journey: it starts on `client.registered`. */
const BANKING_WORKFLOWS: Record<string, string> = {
  welcome: 'welcome.yaml',
  open_current: 'open-current.yaml',
  open_savings: 'open-savings.yaml',
  personal_loan: 'personal-loan.yaml',
  transfer: 'transfer.yaml',
  pay_qr: 'pay-qr.yaml',
  card_freeze: 'card-freeze.yaml',
  report_lost: 'report-lost.yaml',
  update_address: 'update-address.yaml',
  contact_us: 'contact-us.yaml',
};

export const bankingWorkflowYaml = (journey: string) => readFileSync(join(import.meta.dir, 'banking', BANKING_WORKFLOWS[journey]), 'utf8');

const LAST_30_DAYS = '$toMillis(date) > $toMillis($now()) - 2592000000';

/** The banking app, wired to the workflows created for it (journey key → workflow id). */
export function bankingApp(workflows: Record<string, string>, institution = 'the bank'): ClientAppDefinition {
  return clientAppDefinitionSchema.parse({
    name: 'Banking app',
    description: `Everyday banking for the clients of ${institution}.`,
    home: 'home',
    navigation: [
      { page: 'home', label: 'Home', icon: 'house' },
      { page: 'accounts', label: 'Accounts', icon: 'wallet', visibleIf: "'customer' in me.segments" },
      { page: 'cards', label: 'Cards', icon: 'credit-card', visibleIf: "'customer' in me.segments" },
      { page: 'insights', label: 'Insights', icon: 'chart-pie', visibleIf: "'customer' in me.segments" },
      { page: 'products', label: 'Open & apply', icon: 'sparkles' },
      { page: 'activity', label: 'Activity', icon: 'list-checks' },
      { page: 'profile', label: 'Profile', icon: 'user-round' },
      { page: 'help', label: 'Help', icon: 'life-buoy' },
    ],
    pages: {
      home: {
        title: 'Home', hideTitle: true, widgets: [
          {
            id: 'home-hero', type: 'hero', props: {
              eyebrow: 'Welcome back, {{me.firstName}}', title: `= $count(records.accounts) > 0 ? 'Total balance' : "Let's get you started"`,
              value: "= $count(records.accounts) > 0 ? $sum(records.accounts[type in ['current', 'savings']].balance) : ''", format: 'money',
              subtitle: "= $count(records.accounts) > 0 ? 'Across your current and savings accounts' : 'Open your first account in about three minutes — no paperwork.'", art: 'wallet',
            },
          },
          {
            id: 'home-onboard', type: 'callout', visibleIf: "$not('customer' in me.segments)", props: {
              title: 'Open your first account', text: 'Tell us about you, upload an ID and we do the rest. Most accounts are ready the same day.', tone: 'brand', action: 'Get started', journey: 'open_current',
            },
          },
          {
            id: 'home-actions', type: 'quick-actions', visibleIf: "'customer' in me.segments", props: {
              actions: [
                { label: 'Move money', icon: 'arrow-left-right', journey: 'transfer' },
                { label: 'Pay with QR', icon: 'qr-code', journey: 'pay_qr' },
                { label: 'Cards', icon: 'credit-card', page: 'cards' },
                { label: 'Save', icon: 'piggy-bank', journey: 'open_savings' },
                { label: 'Borrow', icon: 'landmark', journey: 'personal_loan' },
              ],
            },
          },
          // Always at hand: scan a shop's code and pay, full screen (docs/plans/14).
          { id: 'home-pay', type: 'fab', visibleIf: "'customer' in me.segments", props: { label: 'Pay', icon: 'scan-line', journey: 'pay_qr', presentation: 'fullscreen', position: 'bottom-right', color: 'accent' } },
          { id: 'home-requests', type: 'requests', visibleIf: "$count(requests[status = 'open']) > 0", props: { title: 'Waiting for you' } },
          { id: 'home-accounts', type: 'accounts', visibleIf: '$count(records.accounts) > 0', props: { title: 'Your accounts', source: 'records:accounts', page: 'account' } },
          {
            id: 'home-grid', type: 'section', visibleIf: '$count(records.transactions) > 0', props: { layout: 'grid-2' }, children: [
              { id: 'home-tx', type: 'transactions', props: { title: 'Recent transactions', source: 'records:transactions', limit: 6, showAccount: true } },
              { id: 'home-spend', type: 'chart', props: { title: 'Spending this month', source: 'records:transactions', filter: `amount < 0 and category != 'Transfers' and category != 'Savings' and ${LAST_30_DAYS}`, groupBy: 'category', value: 'amount', absolute: true, kind: 'donut', format: 'money' } },
            ],
          },
        ],
      },
      accounts: {
        title: 'Accounts', description: 'Balances and everything that moved.', widgets: [
          { id: 'acc-cards', type: 'accounts', props: { title: '', source: 'records:accounts', page: 'account' } },
          { id: 'acc-actions', type: 'quick-actions', props: { actions: [{ label: 'Move money', icon: 'arrow-left-right', journey: 'transfer' }, { label: 'Pay with QR', icon: 'qr-code', journey: 'pay_qr' }, { label: 'Open a savings account', icon: 'piggy-bank', journey: 'open_savings' }] } },
          {
            id: 'acc-receive', type: 'qr-code', visibleIf: "$count(records.accounts[type = 'current']) > 0", props: {
              title: 'Get paid', kind: 'emv', name: '= me.name', account: "= me.customerNumber & '/' & records.accounts[type = 'current'][0].key", accountScheme: 'uk.lintelia.example',
              city: 'London', country: 'GB', reference: '= me.customerNumber', size: 180,
              text: 'Show this code to be paid into your current account (any amount).',
            },
          },
          { id: 'acc-tx', type: 'transactions', props: { title: 'All transactions', source: 'records:transactions', limit: 60, showAccount: true } },
        ],
      },
      account: {
        title: "= $exists(records.accounts[key = $params.key]) ? records.accounts[key = $params.key].name : 'Account'", widgets: [
          {
            id: 'account-details', type: 'details', props: {
              title: '', source: 'records:accounts', fields: [
                { path: 'name', label: 'Account', format: 'text' }, { path: 'balance', label: 'Balance', format: 'money' }, { path: 'number', label: 'Account number', format: 'text' },
                { path: 'sortCode', label: 'Sort code', format: 'text' }, { path: 'rate', label: 'Interest rate (%)', format: 'number' }, { path: 'openedAt', label: 'Opened', format: 'date' },
              ],
            },
          },
          { id: 'account-tx', type: 'transactions', props: { title: 'Transactions', source: 'records:transactions', filter: 'account = $params.key', limit: 100 } },
        ],
      },
      cards: {
        title: 'Cards', description: 'Freeze a card in a tap if you cannot find it; block it if it is gone.', widgets: [
          { id: 'cards-list', type: 'payment-cards', props: { title: '', source: 'records:cards', freezeJourney: 'card_freeze', lostJourney: 'report_lost' } },
          { id: 'cards-tip', type: 'callout', props: { title: 'Card safety', text: 'We will never ask for your PIN or a one-time code by phone or e-mail. If someone does, freeze your card and message us.', tone: 'info' } },
        ],
      },
      insights: {
        title: 'Insights', description: 'Where your money went in the last 30 days.', widgets: [
          {
            id: 'ins-figures', type: 'section', props: { layout: 'grid-3' }, children: [
              { id: 'ins-spent', type: 'stat', props: { label: 'Spent', value: `= $abs($sum(records.transactions[amount < 0 and category != 'Transfers' and category != 'Savings' and ${LAST_30_DAYS}].amount))`, format: 'money', icon: 'shopping-bag', hint: 'last 30 days' } },
              { id: 'ins-in', type: 'stat', props: { label: 'Money in', value: `= $sum(records.transactions[amount > 0 and category != 'Transfers' and ${LAST_30_DAYS}].amount)`, format: 'money', icon: 'trending-up', hint: 'salary and other income' } },
              { id: 'ins-saved', type: 'stat', props: { label: 'In savings', value: "= $sum(records.accounts[type = 'savings'].balance)", format: 'money', icon: 'piggy-bank', hint: 'all savings accounts' } },
            ],
          },
          {
            id: 'ins-grid', type: 'section', props: { layout: 'grid-2' }, children: [
              { id: 'ins-donut', type: 'chart', props: { title: 'By category', source: 'records:transactions', filter: `amount < 0 and category != 'Transfers' and category != 'Savings' and ${LAST_30_DAYS}`, groupBy: 'category', value: 'amount', absolute: true, kind: 'donut', format: 'money' } },
              { id: 'ins-budgets', type: 'progress-list', props: { title: 'Budgets this month', source: 'records:budgets', label: '{{item.category}}', current: `= $abs($sum($records.transactions[category = $$.category and amount < 0 and ${LAST_30_DAYS}].amount))`, target: '= limit', format: 'money' } },
            ],
          },
          { id: 'ins-bars', type: 'chart', props: { title: 'Biggest categories', source: 'records:transactions', filter: `amount < 0 and category != 'Transfers' and category != 'Savings' and ${LAST_30_DAYS}`, groupBy: 'category', value: 'amount', absolute: true, kind: 'bar', format: 'money' } },
        ],
      },
      products: {
        title: 'Open & apply', description: 'Accounts, savings and loans — decided in minutes, from your phone.', widgets: [
          { id: 'prod-journeys', type: 'journeys', props: { title: '', layout: 'grid' } },
          { id: 'prod-faq', type: 'faq', props: { title: 'Good to know', items: [
            { question: 'Does checking a loan offer affect my credit score?', answer: 'No. We only run a full credit check if you accept the offer.' },
            { question: 'How long does opening an account take?', answer: 'About three minutes. Our team checks your identity, usually within a working day.' },
            { question: 'Is my money protected?', answer: 'Yes, eligible deposits are protected up to £85,000 per person.' },
          ] } },
        ],
      },
      activity: {
        title: 'Activity', description: 'Your applications, requests and messages from us.', widgets: [
          { id: 'act-requests', type: 'requests', props: { title: 'Waiting for you', empty: 'Nothing is waiting for you.' } },
          { id: 'act-apps', type: 'applications', props: { title: 'Applications and requests you made', limit: 20, empty: 'Nothing yet.' } },
          { id: 'act-notes', type: 'notifications', props: { title: 'Notifications', limit: 30 } },
        ],
      },
      profile: {
        title: 'Profile', widgets: [
          { id: 'pro-details', type: 'profile', props: { title: 'Personal details' } },
          { id: 'pro-address', type: 'callout', props: { title: 'Moved house?', text: 'Tell us your new address with a proof of address; we update it after a quick check.', tone: 'info', action: 'Change my address', journey: 'update_address' } },
          { id: 'pro-security', type: 'security', props: { title: 'Sign-in and security' } },
          { id: 'pro-privacy', type: 'privacy', props: { title: 'Your data' } },
        ],
      },
      help: {
        title: 'Help', description: 'Answers to common questions, or message us securely.', widgets: [
          { id: 'help-contact', type: 'callout', props: { title: 'Message us', text: 'We answer within one working day, right here in the app.', tone: 'brand', action: 'Write to us', journey: 'contact_us' } },
          { id: 'help-faq', type: 'faq', props: { title: 'Frequently asked questions', items: [
            { question: 'I lost my card. What do I do?', answer: 'Go to Cards and choose "Report lost". We block it at once and send a new one.' },
            { question: 'How do I move money between my accounts?', answer: 'On Home, choose "Move money". Transfers between your own accounts are instant.' },
            { question: 'How do I change my phone number?', answer: 'In Profile, edit your personal details. Address changes need a proof of address.' },
            { question: 'Where are my statements?', answer: 'Every transaction is listed under Accounts. Choose an account to see its history.' },
          ] } },
        ],
      },
    },
    journeys: {
      open_current: { workflowId: workflows.open_current, title: 'Open your first account', description: 'A current account with a debit card. About three minutes.', icon: 'badge-check', category: 'Get started', eligibility: "$not('customer' in segments)", stages: [{ key: 'details', label: 'Your details' }, { key: 'identity', label: 'Identity' }, { key: 'review', label: 'Our checks' }, { key: 'decision', label: 'Account ready' }] },
      open_savings: { workflowId: workflows.open_savings, title: 'Open a savings account', description: 'Easy access at 3.10% AER, or fixed for a year at 4.20% AER.', icon: 'piggy-bank', category: 'Save', eligibility: "'customer' in segments", stages: [{ key: 'product', label: 'Product' }, { key: 'fund', label: 'First deposit' }, { key: 'confirm', label: 'Confirm' }], donePage: 'accounts' },
      personal_loan: { workflowId: workflows.personal_loan, title: 'Personal loan', description: '£1,000 to £50,000 over 1 to 5 years. Representative 7.9% APR.', icon: 'landmark', category: 'Borrow', eligibility: "'customer' in segments", stages: [{ key: 'loan', label: 'Your loan' }, { key: 'finances', label: 'Finances' }, { key: 'offer', label: 'Offer' }, { key: 'review', label: 'Our checks' }, { key: 'decision', label: 'Pay-out' }], donePage: 'accounts' },
      pay_qr: { workflowId: workflows.pay_qr, title: 'Pay with a QR code', description: 'Scan a shop’s code and pay from your current account.', icon: 'qr-code', category: 'Everyday', eligibility: "'customer' in segments", stages: [{ key: 'scan', label: 'Scan' }, { key: 'confirm', label: 'Confirm' }], donePage: 'accounts', presentation: { mode: 'sheet', side: 'bottom', size: 'md', dismissible: true } },
      transfer: { workflowId: workflows.transfer, title: 'Move money', description: 'Between your own accounts, instantly.', icon: 'arrow-left-right', category: 'Everyday', eligibility: "'customer' in segments", stages: [{ key: 'details', label: 'Details' }, { key: 'confirm', label: 'Confirm' }], donePage: 'accounts' },
      card_freeze: { workflowId: workflows.card_freeze, title: 'Freeze or unfreeze a card', icon: 'snowflake', hidden: true, inputs: ['card'], eligibility: "'customer' in segments", donePage: 'cards' },
      report_lost: { workflowId: workflows.report_lost, title: 'Report a lost or stolen card', icon: 'shield-alert', hidden: true, inputs: ['card'], eligibility: "'customer' in segments", stages: [{ key: 'details', label: 'What happened' }], donePage: 'cards' },
      update_address: { workflowId: workflows.update_address, title: 'Change your address', description: 'With a proof of address; checked by our team.', icon: 'map-pin', category: 'Your details', stages: [{ key: 'details', label: 'New address' }, { key: 'review', label: 'Our checks' }], donePage: 'profile' },
      contact_us: { workflowId: workflows.contact_us, title: 'Message us', description: 'A secure message; we answer here within a working day.', icon: 'message-circle', category: 'Help', stages: [{ key: 'message', label: 'Your message' }, { key: 'review', label: 'Our answer' }], donePage: 'activity' },
    },
    collections: [
      { key: 'accounts', label: 'Accounts', description: 'Current, savings and loan accounts', fields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'type', label: 'Type', type: 'text' }, { key: 'balance', label: 'Balance', type: 'money' }, { key: 'number', label: 'Number', type: 'text' }, { key: 'rate', label: 'Rate', type: 'number' }, { key: 'status', label: 'Status', type: 'text' }] },
      { key: 'transactions', label: 'Transactions', description: 'Money in (positive) and out (negative)', fields: [{ key: 'account', label: 'Account key', type: 'text' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'description', label: 'Description', type: 'text' }, { key: 'amount', label: 'Amount', type: 'money' }, { key: 'category', label: 'Category', type: 'text' }] },
      { key: 'cards', label: 'Cards', description: 'Debit and credit cards', fields: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'last4', label: 'Last 4 digits', type: 'text' }, { key: 'status', label: 'Status', type: 'text' }, { key: 'limit', label: 'Limit', type: 'money' }] },
      { key: 'budgets', label: 'Budgets', description: 'Monthly spending limits per category', fields: [{ key: 'category', label: 'Category', type: 'text' }, { key: 'limit', label: 'Limit', type: 'money' }] },
    ],
    profile: {
      fields: [
        { key: 'phone', label: 'Mobile number', type: 'phone', editable: true },
        { key: 'dateOfBirth', label: 'Date of birth', type: 'date', editable: false },
        { key: 'address', label: 'Address', type: 'textarea', editable: false },
        { key: 'employment', label: 'Employment', type: 'select', editable: true, options: ['Employed full-time', 'Employed part-time', 'Self-employed', 'Student', 'Retired', 'Other'] },
        { key: 'marketing', label: 'News and offers by e-mail', type: 'select', editable: true, options: ['Yes', 'No'] },
        { key: 'customerNumber', label: 'Customer number', type: 'text', editable: false },
      ],
    },
    registration: {
      enabled: true, methods: ['email_code', 'password'], fields: ['phone'],
      consents: [{ key: 'terms', label: 'Terms and conditions', version: '2026-01', required: true }, { key: 'privacy', label: 'Privacy notice', version: '2026-01', required: true }],
    },
    identity: { linkByEmail: true, mapping: { externalId: 'externalId', email: 'email', name: 'name', attributes: { customerNumber: 'customerNumber' } }, tokenExchange: { enabled: false, issuer: '', jwksUri: '' } },
    theme: { header: 'light', radius: 'default', accent: '#f5a524' },
    currency: 'GBP', locale: 'en-GB',
    // The demo site (bun run stack) embeds the app with the SDK.
    embed: { allowedOrigins: ['http://localhost:4000'] },
  });
}

export function blankApp(): ClientAppDefinition {
  return structuredClone(BLANK_CLIENT_APP);
}

/**
 * Create (or reuse, by name) the template's workflows, then write the app's draft and, if asked, publish both.
 * Idempotent: running it again keeps existing workflows and republishes the app only when the definition changed.
 * `refresh` (the dev seed): workflows it created itself and nobody edited since are brought up to date with the
 * template (new published version).
 */
export async function installClientAppTemplate(db: TenantDatabase, input: { template: string; by: string; publish: boolean; publishWorkflows?: boolean; institution?: string; refresh?: boolean } & DealerFinanceInput) {
  const publishWorkflows = input.publishWorkflows ?? input.publish;
  let workflows: Record<string, string> = {};
  if (input.template === 'dealer-finance') {
    workflows = await installDealerFinanceWorkflows(db, await dealerFinanceValues(db, input), input.by, publishWorkflows);
  }
  if (input.template === 'banking') {
    for (const journey of Object.keys(BANKING_WORKFLOWS)) {
      const yaml = bankingWorkflowYaml(journey);
      const definition = parseDefinition(yaml);
      const [existing] = await db.select().from(sysWorkflows).where(eq(sysWorkflows.name, definition.name)).limit(1);
      if (existing) {
        workflows[journey] = existing.id;
        if (input.refresh && existing.createdBy === input.by && existing.yaml !== yaml) await refreshWorkflow(db, existing.id, yaml, input.by, publishWorkflows);
        continue;
      }
      const [workflow] = await db.insert(sysWorkflows).values({
        name: definition.name, description: definition.description.slice(0, 255), yaml, status: publishWorkflows ? 'active' : 'draft', version: 1, createdBy: input.by,
      }).returning();
      if (publishWorkflows) await db.insert(workflowVersions).values({ workflowId: workflow.id, version: 1, yaml, startOn: definition.startOn, publishedBy: input.by });
      workflows[journey] = workflow.id;
    }
  }
  const definition = input.template === 'banking' ? bankingApp(workflows, input.institution)
    : input.template === 'dealer-finance' ? dealerFinanceApp(workflows, input.institution) : blankApp();
  const current = await db.select().from(clientApps).where(eq(clientApps.key, 'default')).limit(1);
  const unchanged = current[0]?.activeVersion && stableJson(current[0].draft) === stableJson(withKeyOrder(definition as unknown as Record<string, unknown>));
  if (unchanged) return { appId: current[0].id, definition, workflows, version: null };
  const app = await saveDraft(db, definition as unknown as Record<string, unknown>, input.by);
  const published = input.publish ? await publishVersion(db, app.id, definition as unknown as Record<string, unknown>, input.by) : null;
  return { appId: app.id, definition, workflows, version: published };
}

/** JSON with sorted object keys (JSONB does not keep key order). */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter((k) => (value as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** A template workflow brought up to date: new YAML, published as the next version. */
async function refreshWorkflow(db: TenantDatabase, workflowId: string, yaml: string, by: string, publish: boolean) {
  const definition = parseDefinition(yaml);
  const [{ latest }] = await db.select({ latest: max(workflowVersions.version) }).from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId));
  const version = (latest ?? 0) + 1;
  await db.update(sysWorkflows).set({ yaml, description: definition.description.slice(0, 255), ...(publish ? { status: 'active', version } : {}) }).where(eq(sysWorkflows.id, workflowId));
  if (!publish) return;
  await db.update(workflowVersions).set({ status: 'retired' }).where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.status, 'active')));
  await db.insert(workflowVersions).values({ workflowId, version, yaml, startOn: definition.startOn, publishedBy: by });
}

export async function saveDraft(db: TenantDatabase, raw: Record<string, unknown>, by: string) {
  const definition = withKeyOrder(raw);
  const name = String(definition.name ?? 'Client app').slice(0, 255);
  const [row] = await db.insert(clientApps).values({ key: 'default', name, draft: definition, updatedBy: by })
    .onConflictDoUpdate({ target: [clientApps.tenantId, clientApps.key], set: { draft: definition, name, updatedBy: by, updatedAt: new Date() } })
    .returning();
  return row;
}

/** Freeze a definition as the next version of the app and make it the active one. */
export async function publishVersion(db: TenantDatabase, appId: string, raw: Record<string, unknown>, by: string) {
  const definition = withKeyOrder(raw);
  const [{ latest }] = await db.select({ latest: max(clientAppVersions.version) }).from(clientAppVersions).where(eq(clientAppVersions.appId, appId));
  const version = (latest ?? 0) + 1;
  await db.insert(clientAppVersions).values({ appId, version, definition, publishedBy: by });
  await db.update(clientApps).set({ activeVersion: version }).where(and(eq(clientApps.id, appId)));
  return version;
}
