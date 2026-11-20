import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq, ne } from 'drizzle-orm';
import { clientAppDefinitionSchema, type ClientAppDefinition } from '@repo/lintelia/schemas';
import { connectorInstallations, sysWorkflows, workflowVersions } from '../../entities';
import type { TenantDatabase } from '../../clients/database.client';
import { parseDefinition } from '../../engine/definition';
import { BadRequestError } from '../../http/errors';

/**
 * Dealer finance (indirect auto lending, docs/plans/12): dealers submit deals with their stipulations, AI reads the
 * documents, underwriting decides (asking the dealer for more as often as needed), contracts are signed, the funding
 * package is audited, the dealer is paid in QuickBooks, the loan is boarded in LoanPro and the buyer gets an app to
 * follow and pay their loan. Servicing events from LoanPro keep running afterwards.
 *
 * A "solution": workflows + functions + a client app, wired to the institution's connections at install time
 * (`${KEY}` placeholders in the YAML).
 */
export const DEALER_FINANCE_REQUIRES = [
  { key: 'AI', connector: 'ai', label: 'AI document reading', description: 'Reads pay stubs and buyer orders, writes the analyst summary.' },
  { key: 'LOANPRO', connector: 'loanpro', label: 'LoanPro', description: 'Loan servicing: boarding, payments, servicing events.' },
  { key: 'DOCUMENSO', connector: 'documenso', label: 'Documenso', description: 'Retail installment contract and dealer assignment.' },
  { key: 'SHEETS', connector: 'http', label: 'Deal log (Google Sheets API)', description: 'An HTTP API connection to the Sheets API.' },
  { key: 'QUICKBOOKS', connector: 'http', label: 'QuickBooks Online API', description: 'An HTTP API connection to QuickBooks (pays dealers).' },
] as const;

export const DEALER_FINANCE_PARAMETERS = [
  { key: 'SPREADSHEET_ID', label: 'Spreadsheet id of the deal log', default: 'dealer-deal-log', pattern: '^[A-Za-z0-9_-]{1,100}$' },
  { key: 'QBO_REALM', label: 'QuickBooks company id (realm)', default: '9130350000000001', pattern: '^[0-9]{1,30}$' },
  { key: 'DEALER_FEE', label: 'Acquisition fee kept per contract (USD)', default: '395', pattern: '^[0-9]{1,6}(\\.[0-9]{1,2})?$' },
] as const;

/** Workflow files in install order: functions first (others call them), the deal last (it calls the title workflow). */
const FILES = {
  FN_LOG_DEAL: 'log-deal.yaml',
  FN_PAY_DEALER: 'pay-dealer.yaml',
  WF_TITLE: 'title-tracking.yaml',
  payment_posted: 'payment-posted.yaml',
  delinquency: 'delinquency.yaml',
  paid_off: 'paid-off.yaml',
  make_payment: 'make-payment.yaml',
  payoff: 'payoff.yaml',
  hardship: 'hardship.yaml',
  dealer_signup: 'dealer-signup.yaml',
  submit_deal: 'deal.yaml',
} as const;
export type DealerFinanceWorkflow = keyof typeof FILES;

export const dealerFinanceYaml = (file: DealerFinanceWorkflow) => readFileSync(join(import.meta.dir, FILES[file]), 'utf8');

/** `${KEY}` → value (only upper-case keys: `${{…}}` money templates are left alone). Unknown keys are an error. */
export function fillPlaceholders(yaml: string, values: Record<string, string>) {
  return yaml.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_, key: string) => {
    if (values[key] === undefined) throw new BadRequestError(`Missing value for \${${key}}`);
    return values[key];
  });
}

export interface DealerFinanceInput {
  connections?: Record<string, string>;
  parameters?: Record<string, string>;
}

/** The connections and parameters, checked against the tenant's connections. */
export async function dealerFinanceValues(db: TenantDatabase, input: DealerFinanceInput) {
  const values: Record<string, string> = {};
  const installed = await db.select().from(connectorInstallations).where(ne(connectorInstallations.status, 'disabled'));
  for (const need of DEALER_FINANCE_REQUIRES) {
    const id = String(input.connections?.[need.key] ?? '');
    const connection = installed.find((row) => row.id === id);
    if (!connection) throw new BadRequestError(`Choose a ${need.label} connection`);
    if (connection.connectorId !== need.connector) throw new BadRequestError(`${need.label}: that connection is not a ${need.connector} connection`);
    values[need.key] = connection.id;
  }
  for (const parameter of DEALER_FINANCE_PARAMETERS) {
    const value = String(input.parameters?.[parameter.key] ?? parameter.default).trim();
    if (!new RegExp(parameter.pattern).test(value)) throw new BadRequestError(`${parameter.label}: "${value}" is not valid`);
    values[parameter.key] = value;
  }
  return values;
}

/**
 * Create the solution's workflows (reusing same-named ones: installing twice does not duplicate them) and publish them
 * when asked. Returns workflow ids by file key.
 */
export async function installDealerFinanceWorkflows(db: TenantDatabase, values: Record<string, string>, by: string, publish: boolean) {
  const ids: Record<string, string> = {};
  for (const key of Object.keys(FILES) as DealerFinanceWorkflow[]) {
    const yaml = fillPlaceholders(dealerFinanceYaml(key), { ...values, ...ids });
    const definition = parseDefinition(yaml);
    const [existing] = await db.select().from(sysWorkflows).where(eq(sysWorkflows.name, definition.name)).limit(1);
    if (existing) {
      ids[key] = existing.id;
      continue;
    }
    const [workflow] = await db.insert(sysWorkflows).values({
      name: definition.name, description: definition.description.slice(0, 255), yaml, status: publish ? 'active' : 'draft', version: 1, createdBy: by,
    }).returning();
    if (publish) await db.insert(workflowVersions).values({ workflowId: workflow.id, version: 1, yaml, startOn: definition.startOn, publishedBy: by });
    ids[key] = workflow.id;
  }
  return ids;
}

const IS_DEALER = "'dealer' in me.segments";
const IS_BORROWER = "'borrower' in me.segments";
const HAS_LOAN = '$count(records.loans) > 0';
const NEXT_PAYMENT = "'Next payment $' & $formatNumber(records.loans[0].nextPaymentAmount, '#,##0.00') & ' due ' & $fromMillis($toMillis(records.loans[0].nextPaymentDate), '[MNn] [D], [Y]')";

/** The portal for dealers and borrowers (one app: what each sees depends on their segment). */
export function dealerFinanceApp(workflows: Record<string, string>, institution = 'us'): ClientAppDefinition {
  return clientAppDefinitionSchema.parse({
    name: 'Dealer & borrower portal',
    description: `Dealers send deals to ${institution}; borrowers follow and pay their auto loan.`,
    home: 'home',
    navigation: [
      { page: 'home', label: 'Home', icon: 'house' },
      { page: 'deals', label: 'Deals', icon: 'car', visibleIf: IS_DEALER },
      { page: 'loan', label: 'My loan', icon: 'landmark', visibleIf: IS_BORROWER },
      { page: 'activity', label: 'Activity', icon: 'list-checks' },
      { page: 'profile', label: 'Profile', icon: 'user-round' },
      { page: 'help', label: 'Help', icon: 'life-buoy' },
    ],
    pages: {
      home: {
        title: 'Home', hideTitle: true, widgets: [
          {
            id: 'home-hero', type: 'hero', props: {
              eyebrow: 'Welcome, {{me.firstName}}',
              title: `= ${HAS_LOAN} ? 'Your loan balance' : (${IS_DEALER} ? me.dealerName : 'Auto finance, done together')`,
              value: `= ${HAS_LOAN} ? $sum(records.loans.balance) : ''`, format: 'money', currency: 'USD',
              subtitle: `= ${HAS_LOAN} ? ${NEXT_PAYMENT} : (${IS_DEALER} ? 'Submit a deal; most decisions come back within four business hours.' : 'Dealers: apply to send us deals. Borrowers: your loan shows here once it is funded.')`,
              art: 'wallet',
            },
          },
          {
            id: 'home-partner', type: 'callout', visibleIf: `$not(${IS_DEALER}) and $not(${IS_BORROWER})`, props: {
              title: 'Become a dealer partner', text: 'Licensed dealerships send us deals from this portal: decisions in hours, funding in a day after the paperwork is in.', tone: 'brand', action: 'Apply as a dealer', journey: 'dealer_signup',
            },
          },
          {
            id: 'home-dealer-actions', type: 'quick-actions', visibleIf: IS_DEALER, props: {
              actions: [
                { label: 'Submit a deal', icon: 'file-plus', journey: 'submit_deal' },
                { label: 'All deals', icon: 'car', page: 'deals' },
                { label: 'Help', icon: 'life-buoy', page: 'help' },
              ],
            },
          },
          {
            id: 'home-borrower-actions', type: 'quick-actions', visibleIf: HAS_LOAN, props: {
              actions: [
                { label: 'Make a payment', icon: 'circle-dollar-sign', journey: 'make_payment' },
                { label: 'Payoff quote', icon: 'badge-check', journey: 'payoff' },
                { label: 'My loan', icon: 'landmark', page: 'loan' },
                { label: 'Need help?', icon: 'life-buoy', journey: 'hardship' },
              ],
            },
          },
          { id: 'home-requests', type: 'requests', visibleIf: "$count(requests[status = 'open']) > 0", props: { title: 'Waiting for you' } },
          { id: 'home-deals', type: 'applications', visibleIf: IS_DEALER, props: { title: 'Your latest deals', limit: 5, empty: 'No deals yet — submit your first one.' } },
          {
            id: 'home-payments', type: 'table', visibleIf: '$count(records.payments) > 0', props: {
              title: 'Recent payments', source: 'records:payments', sort: 'date', descending: true, limit: 5,
              columns: [{ field: 'date', label: 'Date', format: 'date' }, { field: 'description', label: 'Payment', format: 'text' }, { field: 'amount', label: 'Amount', format: 'money' }, { field: 'balance', label: 'Balance after', format: 'money' }],
            },
          },
          { id: 'home-notes', type: 'notifications', props: { title: 'Messages', limit: 5 } },
        ],
      },
      deals: {
        title: 'Deals', description: 'Every deal you sent us, where it is, and what we need from you.', widgets: [
          { id: 'deals-actions', type: 'quick-actions', props: { actions: [{ label: 'Submit a deal', icon: 'file-plus', journey: 'submit_deal' }] } },
          { id: 'deals-requests', type: 'requests', props: { title: 'We need something from you', empty: 'Nothing is waiting for you.' } },
          { id: 'deals-list', type: 'applications', props: { title: 'All deals', limit: 50, empty: 'No deals yet.' } },
          { id: 'deals-faq', type: 'faq', props: { title: 'Stipulations', items: [
            { question: 'What do I upload with a deal?', answer: "The buyer's latest pay stub, the signed buyer's order and the buyer's driver's license. We read them automatically and only ask for more when something does not add up." },
            { question: 'When do I get funded?', answer: 'After the contracts are signed and the funding package (title application with our lien, proof of insurance) passes the audit — usually the next business day. We pay the amount financed minus the acquisition fee.' },
          ] } },
        ],
      },
      loan: {
        title: 'My loan', description: 'Balance, schedule and payments — straight from our servicing system.', widgets: [
          {
            id: 'loan-hero', type: 'hero', visibleIf: HAS_LOAN, props: {
              eyebrow: '= records.loans[0].name', title: 'Balance', value: '= records.loans[0].balance', format: 'money', currency: 'USD', subtitle: `= ${NEXT_PAYMENT}`, art: 'shield',
            },
          },
          {
            id: 'loan-actions', type: 'quick-actions', visibleIf: HAS_LOAN, props: {
              actions: [
                { label: 'Make a payment', icon: 'circle-dollar-sign', journey: 'make_payment' },
                { label: 'Payoff quote', icon: 'badge-check', journey: 'payoff' },
                { label: 'Having trouble paying?', icon: 'life-buoy', journey: 'hardship' },
              ],
            },
          },
          {
            id: 'loan-details', type: 'details', visibleIf: HAS_LOAN, props: {
              title: 'Loan details', source: 'records:loans', fields: [
                { path: 'displayId', label: 'Loan number', format: 'text' }, { path: 'status', label: 'Status', format: 'text' },
                { path: 'vehicle', label: 'Vehicle', format: 'text' }, { path: 'vin', label: 'VIN', format: 'text' },
                { path: 'amount', label: 'Amount financed', format: 'money' }, { path: 'apr', label: 'APR (%)', format: 'number' },
                { path: 'termMonths', label: 'Term (months)', format: 'number' }, { path: 'payment', label: 'Monthly payment', format: 'money' },
                { path: 'nextPaymentDate', label: 'Next payment', format: 'date' }, { path: 'daysPastDue', label: 'Days past due', format: 'number' },
                { path: 'maturityDate', label: 'Last payment', format: 'date' },
              ],
            },
          },
          {
            id: 'loan-payments', type: 'table', props: {
              title: 'Payments', source: 'records:payments', sort: 'date', descending: true, limit: 60, empty: 'No payments yet.',
              columns: [{ field: 'date', label: 'Date', format: 'date' }, { field: 'amount', label: 'Amount', format: 'money' }, { field: 'principal', label: 'Principal', format: 'money' }, { field: 'interest', label: 'Interest', format: 'money' }, { field: 'balance', label: 'Balance after', format: 'money' }],
            },
          },
        ],
      },
      activity: {
        title: 'Activity', description: 'Requests from us, what you started, and our messages.', widgets: [
          { id: 'act-requests', type: 'requests', props: { title: 'Waiting for you', empty: 'Nothing is waiting for you.' } },
          { id: 'act-apps', type: 'applications', props: { title: 'Started by you', limit: 30, empty: 'Nothing yet.' } },
          { id: 'act-notes', type: 'notifications', props: { title: 'Notifications', limit: 30 } },
        ],
      },
      profile: {
        title: 'Profile', widgets: [
          { id: 'pro-details', type: 'profile', props: { title: 'Your details' } },
          { id: 'pro-security', type: 'security', props: { title: 'Sign-in and security' } },
          { id: 'pro-privacy', type: 'privacy', props: { title: 'Your data' } },
        ],
      },
      help: {
        title: 'Help', widgets: [
          { id: 'help-hardship', type: 'callout', visibleIf: HAS_LOAN, props: { title: 'Having trouble paying?', text: 'Tell us early: we can move your due date or arrange a plan. Asking does not affect your credit.', tone: 'brand', action: 'Ask for help', journey: 'hardship' } },
          { id: 'help-faq', type: 'faq', props: { title: 'Frequently asked questions', items: [
            { question: 'How do I pay my loan?', answer: 'Choose "Make a payment" on Home or My loan. Payments before 5 pm ET post the same day.' },
            { question: 'When do I get my title?', answer: 'Within 10 business days after the loan is paid off — we release our lien as soon as the payoff posts.' },
            { question: 'I am a dealer. How fast are decisions?', answer: 'Most deals are decided within four business hours. If we need anything, it shows under "Waiting for you".' },
          ] } },
        ],
      },
    },
    journeys: {
      submit_deal: {
        workflowId: workflows.submit_deal, title: 'Submit a deal', description: 'Buyer, vehicle and structure, with the stipulations. Decision in hours.', icon: 'car', category: 'Deals',
        eligibility: "'dealer' in segments", donePage: 'deals',
        stages: [
          { key: 'submitted', label: 'Deal' }, { key: 'documents', label: 'Stipulations' }, { key: 'underwriting', label: 'Underwriting' }, { key: 'conditions', label: 'Conditions' },
          { key: 'contracting', label: 'Contracts' }, { key: 'funding', label: 'Funding' }, { key: 'funded', label: 'Funded' },
        ],
      },
      dealer_signup: {
        workflowId: workflows.dealer_signup, title: 'Become a dealer partner', description: 'Your licence, W-9 and our dealer agreement.', icon: 'store', category: 'Dealers',
        eligibility: "$not('dealer' in segments) and $not('borrower' in segments)",
        stages: [{ key: 'dealership', label: 'Dealership' }, { key: 'documents', label: 'Documents' }, { key: 'review', label: 'Our checks' }, { key: 'approved', label: 'Approved' }],
      },
      make_payment: {
        workflowId: workflows.make_payment, title: 'Make a payment', description: 'Pay towards your auto loan from your bank account.', icon: 'circle-dollar-sign', category: 'My loan',
        eligibility: "'borrower' in segments", donePage: 'loan', stages: [{ key: 'amount', label: 'Amount' }, { key: 'confirm', label: 'Confirm' }],
      },
      payoff: {
        workflowId: workflows.payoff, title: 'Payoff quote', description: 'What it takes to pay off your loan today.', icon: 'badge-check', category: 'My loan',
        eligibility: "'borrower' in segments", donePage: 'loan', stages: [{ key: 'quote', label: 'Quote' }],
      },
      hardship: {
        workflowId: workflows.hardship, title: 'Having trouble paying?', description: 'A due-date change, a deferral or a plan.', icon: 'life-buoy', category: 'My loan',
        eligibility: "'borrower' in segments", donePage: 'loan', stages: [{ key: 'details', label: 'Your request' }, { key: 'review', label: 'Our answer' }],
      },
    },
    collections: [
      {
        key: 'loans', label: 'Loans', description: 'The borrower\'s auto loans (written by the LoanPro connector)', fields: [
          { key: 'name', label: 'Name', type: 'text' }, { key: 'displayId', label: 'Loan number', type: 'text' }, { key: 'balance', label: 'Balance', type: 'money' },
          { key: 'payment', label: 'Monthly payment', type: 'money' }, { key: 'nextPaymentDate', label: 'Next payment', type: 'date' }, { key: 'nextPaymentAmount', label: 'Next payment amount', type: 'money' },
          { key: 'daysPastDue', label: 'Days past due', type: 'number' }, { key: 'payoff', label: 'Payoff', type: 'money' }, { key: 'status', label: 'Status', type: 'text' },
        ],
      },
      {
        key: 'payments', label: 'Payments', description: 'Payments posted in LoanPro', fields: [
          { key: 'loan', label: 'Loan number', type: 'text' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'amount', label: 'Amount', type: 'money' },
          { key: 'principal', label: 'Principal', type: 'money' }, { key: 'interest', label: 'Interest', type: 'money' }, { key: 'balance', label: 'Balance after', type: 'money' },
        ],
      },
    ],
    profile: {
      fields: [
        { key: 'phone', label: 'Mobile number', type: 'phone', editable: true },
        { key: 'dealerName', label: 'Dealership', type: 'text', editable: false },
        { key: 'dealerLicense', label: 'Dealer licence', type: 'text', editable: false },
      ],
    },
    registration: {
      enabled: true, methods: ['email_code', 'password'], fields: ['phone'],
      consents: [{ key: 'terms', label: 'Terms of use', version: '2026-01', required: true }, { key: 'privacy', label: 'Privacy notice', version: '2026-01', required: true }],
    },
    identity: { linkByEmail: true, mapping: { externalId: 'externalId', email: 'email', name: 'name', attributes: {} }, tokenExchange: { enabled: false, issuer: '', jwksUri: '' } },
    theme: { header: 'brand', radius: 'default' },
    currency: 'USD', locale: 'en-US',
  });
}
