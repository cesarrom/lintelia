/**
 * Client apps (docs/plans/11): what an institution's clients see and do — pages made of widgets, journeys run by
 * workflows, the data collections screens may read, the client profile, sign-up and how clients from the institution's
 * own systems are identified. Shared by the API (validation at publish, data allow-list, identity mapping), the
 * web runtime (rendering) and the studio (editing).
 */
import { z } from 'zod';
import type { JsonSchema } from './components.schema';

// --- definition ----------------------------------------------------------------------------------------------------------

export interface ClientWidget {
  id: string;
  type: string;
  props: Record<string, unknown>;
  /** JSONata over the page scope (`me`, `records`, `params`…); the widget shows when true. */
  visibleIf?: string;
  children?: ClientWidget[];
}

export const clientWidgetSchema: z.ZodType<ClientWidget> = z.lazy(() => z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
  visibleIf: z.string().optional(),
  children: z.array(clientWidgetSchema).optional(),
})) as z.ZodType<ClientWidget>;

const key = z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/, 'lower-case letters, digits, - and _ (starts with a letter)');

export const clientPageSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  /** Hide the page title (e.g. a home page whose hero says it all). */
  hideTitle: z.boolean().optional(),
  visibleIf: z.string().optional(),
  widgets: z.array(clientWidgetSchema).default([]),
});
export type ClientPage = z.infer<typeof clientPageSchema>;

export const clientNavItemSchema = z.object({
  page: key,
  label: z.string().min(1),
  icon: z.string().optional(),
  visibleIf: z.string().optional(),
});

export const clientJourneySchema = z.object({
  /** The workflow that runs the journey (its active version when the journey starts). */
  workflowId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  /** JSONata over `me` (the client's profile); evaluated by the API when the journey starts. */
  eligibility: z.string().optional(),
  /** Input keys a button may pass when starting the journey (e.g. the card to freeze); anything else is dropped. */
  inputs: z.array(z.string()).default([]),
  /** Milestones the client sees; `client.screen` steps name theirs with `stage`. */
  stages: z.array(z.object({ key: z.string(), label: z.string() })).default([]),
  /** Not listed among the journeys a client can start (started by buttons only, e.g. "freeze card"). */
  hidden: z.boolean().optional(),
  /** Page to show when the journey ends. */
  donePage: z.string().optional(),
  /**
   * How the journey opens (docs/plans/14): a page of the app (default), a dialog over the page, a sheet sliding from the
   * side or the bottom, or the whole screen (a scanner, a checkout). Buttons may override it.
   */
  presentation: z.object({
    mode: z.enum(['page', 'dialog', 'sheet', 'fullscreen']).default('page'),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    side: z.enum(['right', 'bottom']).optional(),
    /** The client may close it (a close button, Escape, clicking outside); the journey stays where it was. */
    dismissible: z.boolean().optional(),
  }).optional(),
});
export const JOURNEY_PRESENTATIONS = ['page', 'dialog', 'sheet', 'fullscreen'] as const;
export type JourneyPresentation = NonNullable<z.infer<typeof clientJourneySchema>['presentation']>;
export type ClientJourney = z.infer<typeof clientJourneySchema>;

export const clientCollectionSchema = z.object({
  key,
  label: z.string().min(1),
  description: z.string().optional(),
  /** Known fields (documentation and binding pickers in the studio). */
  fields: z.array(z.object({ key: z.string(), label: z.string(), type: z.enum(['text', 'number', 'money', 'date', 'boolean']).default('text') })).default([]),
});
export type ClientCollection = z.infer<typeof clientCollectionSchema>;

export const PROFILE_FIELD_TYPES = ['text', 'email', 'phone', 'date', 'number', 'select', 'textarea'] as const;

const attributeKey = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/, 'letters, digits and _ (starts with a letter)');

export const clientProfileFieldSchema = z.object({
  key: attributeKey,
  label: z.string().min(1),
  type: z.enum(PROFILE_FIELD_TYPES).default('text'),
  options: z.array(z.string()).optional(),
  /** The client may change it from the profile page (otherwise only workflows and the institution's API do). */
  editable: z.boolean().default(false),
  required: z.boolean().optional(),
});
export type ClientProfileField = z.infer<typeof clientProfileFieldSchema>;

export const clientRegistrationSchema = z.object({
  /** Self-service sign-up on the app. */
  enabled: z.boolean().default(true),
  methods: z.array(z.enum(['email_code', 'password'])).default(['email_code', 'password']),
  /** Profile fields asked at sign-up. */
  fields: z.array(z.string()).default([]),
  consents: z.array(z.object({ key: z.string(), label: z.string(), version: z.string(), url: z.string().optional(), required: z.boolean().default(true) })).default([]),
});

export const clientIdentitySchema = z.object({
  /** Link a new external identity to an existing client with the same (verified) e-mail address. */
  linkByEmail: z.boolean().default(true),
  /**
   * JSONata per profile field, evaluated over the input that identifies a client: the body of `POST /client-sessions`
   * or the claims of an exchanged token. E.g. `{ externalId: "sub", email: "email", attributes: { tier: "plan" } }`.
   */
  mapping: z.object({
    externalId: z.string().default('externalId'),
    email: z.string().default('email'),
    name: z.string().default('name'),
    attributes: z.record(z.string(), z.string()).default({}),
    segments: z.string().optional(),
  }).default({}),
  /** The institution's identity provider: its tokens can be exchanged for a client session. */
  tokenExchange: z.object({
    enabled: z.boolean().default(false),
    issuer: z.string().default(''),
    jwksUri: z.string().default(''),
    audience: z.string().optional(),
  }).default({}),
});
export type ClientIdentity = z.infer<typeof clientIdentitySchema>;

export const APP_FONTS = ['system', 'humanist', 'geometric', 'serif', 'rounded', 'mono'] as const;

export const clientThemeSchema = z.object({
  /** Defaults to the institution's brand colour. */
  primary: z.string().optional(),
  /** Second colour: highlights, badges, the floating button (docs/plans/14). */
  accent: z.string().optional(),
  radius: z.enum(['soft', 'default', 'sharp']).default('default'),
  /** `brand`: coloured header; `light`: white header. */
  header: z.enum(['light', 'brand']).default('light'),
  logoUrl: z.string().optional(),
  /** Type: font stacks the devices already have (no download, no tracking). */
  font: z.enum(APP_FONTS).optional(),
  /** Buttons: rounded (default), pill or square. */
  buttonShape: z.enum(['rounded', 'pill', 'square']).optional(),
  /** Light, dark, or follow the device. */
  colorScheme: z.enum(['auto', 'light', 'dark']).optional(),
  /** Tint of the app's background (a very light tone of a colour), e.g. #f5f3ff. */
  background: z.string().optional(),
});

export const clientAppDefinitionSchema = z.object({
  schemaVersion: z.literal('1').default('1'),
  name: z.string().min(1),
  description: z.string().optional(),
  home: key,
  navigation: z.array(clientNavItemSchema).default([]),
  pages: z.record(key, clientPageSchema),
  journeys: z.record(key, clientJourneySchema).default({}),
  collections: z.array(clientCollectionSchema).default([]),
  profile: z.object({ fields: z.array(clientProfileFieldSchema).default([]) }).default({}),
  registration: clientRegistrationSchema.default({}),
  identity: clientIdentitySchema.default({}),
  theme: clientThemeSchema.default({}),
  /** Regional settings: the currency amounts default to (ISO 4217) and the locale numbers and dates are written in. */
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  locale: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/).optional(),
  /** Sites allowed to show the app in a frame (the SDK's embedded mode), e.g. `https://www.bank.com`. */
  embed: z.object({ allowedOrigins: z.array(z.string()).default([]) }).default({}),
  /** Order of `pages` and `journeys` as authored (JSONB storage does not keep object key order). */
  pageOrder: z.array(z.string()).optional(),
  journeyOrder: z.array(z.string()).optional(),
});
export type ClientAppDefinition = z.infer<typeof clientAppDefinitionSchema>;

/** Remember the authored order of pages and journeys before storing a definition. */
export function withKeyOrder<T extends Record<string, unknown>>(definition: T): T {
  // A definition read back from storage has its keys in JSONB order: the order it carries wins.
  const keep = (map: unknown, order: unknown) => {
    const keys = map && typeof map === 'object' ? Object.keys(map as object) : [];
    const known = Array.isArray(order) ? order.filter((k): k is string => typeof k === 'string' && keys.includes(k)) : [];
    return [...known, ...keys.filter((k) => !known.includes(k))];
  };
  return { ...definition, pageOrder: keep(definition.pages, definition.pageOrder), journeyOrder: keep(definition.journeys, definition.journeyOrder) };
}

/** Entries of a keyed map in authored order (keys missing from `order` come last, in their stored order). */
export function ordered<V>(map: Record<string, V>, order: string[] | undefined): Array<[string, V]> {
  const keys = Object.keys(map);
  const rank = (k: string) => { const i = order?.indexOf(k) ?? -1; return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  return keys.sort((a, b) => rank(a) - rank(b) || keys.indexOf(a) - keys.indexOf(b)).map((k) => [k, map[k]]);
}

// --- data sources ------------------------------------------------------------------------------------------------------

/**
 * What screens can read (always resolved by the API under the client's identity):
 *  `me` (profile), `records:<collection>` (declared collections only), `cases` (my applications), `requests`
 *  (waiting for me), `notifications`, `journeys` (the journeys I may start).
 */
export const BUILTIN_SOURCES = ['me', 'cases', 'requests', 'notifications', 'journeys'] as const;
export const isRecordSource = (source: string) => source.startsWith('records:');
export const recordCollectionOf = (source: string) => source.slice('records:'.length);

// --- widget catalogue --------------------------------------------------------------------------------------------------

export type WidgetCategory = 'layout' | 'content' | 'data' | 'banking' | 'process' | 'profile' | 'embed';

export interface ClientWidgetDefinition {
  type: string;
  title: string;
  description: string;
  category: WidgetCategory;
  /** lucide icon name (studio palette). */
  icon: string;
  /** Holds child widgets. */
  container?: boolean;
  props: JsonSchema;
  defaults: Record<string, unknown>;
  /** Sources the widget reads, from its props. */
  sources?: (props: Record<string, any>) => string[];
}

const str = (title: string, description?: string, extra: Record<string, unknown> = {}): JsonSchema => ({ type: 'string', title, description, ...extra });
const expr = (title: string, description?: string): JsonSchema => ({ type: 'string', title, description, 'x-expression': true });
const source = (title = 'Data', description = 'a declared collection (records:…) or me, cases, requests, notifications'): JsonSchema => ({ type: 'string', title, description, 'x-widget': 'source' });
const FORMAT: JsonSchema = { type: 'string', title: 'Format', enum: ['text', 'money', 'number', 'percent', 'date', 'datetime', 'relative'], 'x-enum-labels': ['Text', 'Money', 'Number', 'Percent', 'Date', 'Date and time', 'Relative time'] };
const ICON = str('Icon', 'lucide icon name, e.g. wallet, credit-card, piggy-bank', { 'x-widget': 'icon' });
const PAGE = str('Page', undefined, { 'x-widget': 'page' });
const JOURNEY = str('Journey', undefined, { 'x-widget': 'journey' });
const TONE: JsonSchema = { type: 'string', title: 'Tone', enum: ['info', 'success', 'warning', 'brand'], 'x-enum-labels': ['Information', 'Success', 'Warning', 'Brand'] };
const fromProp = (prop: string) => (props: Record<string, any>) => (typeof props[prop] === 'string' && props[prop] ? [props[prop]] : []);

const PRESENTATION: JsonSchema = {
  type: 'string', title: 'Opens as', description: 'how the journey opens from here (default: the journey\'s setting)',
  enum: ['', 'page', 'dialog', 'sheet', 'fullscreen'], 'x-enum-labels': ['As the journey says', 'A page', 'A dialog', 'A sheet (side / bottom)', 'The whole screen'],
};
const LINK_PROPS: Record<string, JsonSchema> = {
  journey: JOURNEY,
  presentation: PRESENTATION,
  input: { type: 'object', title: 'Journey input', description: 'values passed to the journey (templates over the item allowed)', 'x-widget': 'keyValue' },
  page: PAGE,
  params: { type: 'object', title: 'Page parameters', description: 'e.g. key → {{item.key}}', 'x-widget': 'keyValue' },
};

export const CLIENT_WIDGETS: ClientWidgetDefinition[] = [
  // layout
  {
    type: 'section', title: 'Section', description: 'Groups widgets, optionally in a grid or a card', category: 'layout', icon: 'LayoutTemplate', container: true,
    props: { type: 'object', properties: { title: str('Title'), description: str('Description'), layout: { type: 'string', title: 'Layout', enum: ['stack', 'grid-2', 'grid-3', 'grid-4'], 'x-enum-labels': ['Stack', '2 columns', '3 columns', '4 columns'] }, card: { type: 'boolean', title: 'Show as a card' } } },
    defaults: { title: 'Section', layout: 'stack' },
  },
  // content
  {
    type: 'hero', title: 'Hero', description: 'Greeting banner in the brand colour, with an optional headline figure', category: 'content', icon: 'Sparkles',
    props: { type: 'object', properties: { eyebrow: expr('Small text above'), title: expr('Title'), subtitle: expr('Subtitle'), value: expr('Figure', 'e.g. = $sum(records.accounts.balance)'), valueLabel: str('Figure label'), format: FORMAT, currency: str('Currency', 'ISO code, e.g. GBP'), art: { type: 'string', title: 'Illustration', enum: ['none', 'welcome', 'wallet', 'shield'], 'x-enum-labels': ['None', 'Documents', 'Wallet', 'Shield'] } } },
    defaults: { eyebrow: 'Welcome back', title: 'Hello {{me.firstName}}', art: 'wallet' },
  },
  {
    type: 'heading', title: 'Heading', description: 'A title for the content below', category: 'content', icon: 'Heading',
    props: { type: 'object', properties: { text: expr('Text'), subtitle: expr('Subtitle') } }, defaults: { text: 'Heading' },
  },
  {
    type: 'text', title: 'Text', description: 'Paragraphs; **bold** and links [label](https://…) are supported', category: 'content', icon: 'Text',
    props: { type: 'object', properties: { text: { ...expr('Text'), 'x-widget': 'textarea' }, muted: { type: 'boolean', title: 'Muted' } } }, defaults: { text: 'Write something helpful.' },
  },
  {
    type: 'callout', title: 'Callout', description: 'A highlighted message', category: 'content', icon: 'Megaphone',
    props: { type: 'object', properties: { title: expr('Title'), text: { ...expr('Text'), 'x-widget': 'textarea' }, tone: TONE, ...LINK_PROPS, action: str('Button label') } },
    defaults: { title: 'Did you know?', text: '', tone: 'info' },
  },
  {
    type: 'image', title: 'Image', description: 'An image from an https address', category: 'content', icon: 'Image',
    props: { type: 'object', properties: { url: str('Address (https)'), alt: str('Description (alt text)'), height: { type: 'number', title: 'Height (px)' } } }, defaults: { url: '', alt: '', height: 200 },
  },
  {
    type: 'faq', title: 'Questions and answers', description: 'Expandable list of questions', category: 'content', icon: 'CircleHelp',
    props: { type: 'object', properties: { title: str('Title'), items: { type: 'array', title: 'Questions', items: { type: 'object', properties: { question: str('Question'), answer: { ...str('Answer'), 'x-widget': 'textarea' } } } } } },
    defaults: { title: 'Frequently asked questions', items: [{ question: 'How do I contact you?', answer: 'Use "Contact us" in the app; we answer within one working day.' }] },
  },
  // data
  {
    type: 'stat', title: 'Figure', description: 'One number with a label', category: 'data', icon: 'Gauge',
    props: { type: 'object', properties: { label: str('Label'), value: expr('Value', 'e.g. = $count(records.cards)'), format: FORMAT, currency: str('Currency'), hint: expr('Hint'), icon: ICON } },
    defaults: { label: 'Figure', value: '0', format: 'number' },
  },
  {
    type: 'list', title: 'List', description: 'Items of a collection, each with a title, details and a value; can open a page or a journey', category: 'data', icon: 'List',
    props: {
      type: 'object', required: ['source'], properties: {
        title: str('Title'), source: source(), filter: expr('Filter', 'JSONata over each item, e.g. status = "active"'), sort: str('Sort by (field)'), descending: { type: 'boolean', title: 'Newest / largest first' }, limit: { type: 'number', title: 'Show at most' },
        itemTitle: expr('Item title', 'e.g. {{item.name}}'), itemSubtitle: expr('Item details'), itemValue: expr('Item value'), valueFormat: FORMAT, icon: ICON, empty: str('When empty'), ...LINK_PROPS,
      },
    },
    defaults: { title: 'List', source: '', itemTitle: '{{item.name}}', limit: 10, empty: 'Nothing yet.' },
    sources: fromProp('source'),
  },
  {
    type: 'table', title: 'Table', description: 'Rows of a collection with chosen columns', category: 'data', icon: 'Table',
    props: {
      type: 'object', required: ['source'], properties: {
        title: str('Title'), source: source(), filter: expr('Filter'), sort: str('Sort by (field)'), descending: { type: 'boolean', title: 'Descending' }, limit: { type: 'number', title: 'Rows at most' },
        columns: { type: 'array', title: 'Columns', items: { type: 'object', properties: { field: str('Field'), label: str('Header'), format: FORMAT } } }, empty: str('When empty'),
      },
    },
    defaults: { title: 'Table', source: '', columns: [{ field: 'name', label: 'Name', format: 'text' }], limit: 20 },
    sources: fromProp('source'),
  },
  {
    type: 'details', title: 'Details', description: 'Label / value pairs (profile, a record picked by page parameter)', category: 'data', icon: 'Rows3',
    props: {
      type: 'object', properties: {
        title: str('Title'), source: source('Data', 'me, or a collection (the item whose key is the page parameter "key", else the first)'),
        fields: { type: 'array', title: 'Fields', items: { type: 'object', properties: { path: str('Field'), label: str('Label'), format: FORMAT } } },
      },
    },
    defaults: { title: 'Details', source: 'me', fields: [{ path: 'name', label: 'Name', format: 'text' }] },
    sources: fromProp('source'),
  },
  {
    type: 'chart', title: 'Chart', description: 'Totals grouped by a field (doughnut or bars)', category: 'data', icon: 'ChartPie',
    props: {
      type: 'object', required: ['source'], properties: {
        title: str('Title'), source: source(), filter: expr('Filter', 'e.g. amount < 0'), groupBy: str('Group by (field)'), value: str('Value field'), absolute: { type: 'boolean', title: 'Use absolute values' },
        kind: { type: 'string', title: 'Kind', enum: ['donut', 'bar'], 'x-enum-labels': ['Doughnut', 'Bars'] }, format: FORMAT, currency: str('Currency'),
      },
    },
    defaults: { title: 'Chart', source: '', groupBy: 'category', value: 'amount', kind: 'donut', format: 'money' },
    sources: fromProp('source'),
  },
  {
    type: 'progress-list', title: 'Progress bars', description: 'How much of a limit is used (budgets, savings goals)', category: 'data', icon: 'ChartBarIncreasing',
    props: {
      type: 'object', required: ['source'], properties: {
        title: str('Title'), source: source(), label: expr('Label', '{{item.category}}'), current: expr('Current value', '= spent'), target: expr('Limit / goal', '= limit'), format: FORMAT, currency: str('Currency'),
      },
    },
    defaults: { title: 'Budgets', source: '', label: '{{item.category}}', current: '= spent', target: '= limit', format: 'money' },
    sources: fromProp('source'),
  },
  // banking
  {
    type: 'accounts', title: 'Account cards', description: 'Accounts with their balance, in the brand colours', category: 'banking', icon: 'Wallet',
    props: { type: 'object', properties: { title: str('Title'), source: source(), filter: expr('Filter'), page: PAGE } },
    defaults: { title: 'Your accounts', source: 'records:accounts', page: 'account' },
    sources: fromProp('source'),
  },
  {
    type: 'transactions', title: 'Transactions', description: 'Money in and out, grouped by day, with categories', category: 'banking', icon: 'ArrowLeftRight',
    props: { type: 'object', properties: { title: str('Title'), source: source(), filter: expr('Filter', 'e.g. account = $params.key'), limit: { type: 'number', title: 'Show at most' }, showAccount: { type: 'boolean', title: 'Show the account' } } },
    defaults: { title: 'Recent transactions', source: 'records:transactions', limit: 8 },
    sources: fromProp('source'),
  },
  {
    type: 'payment-cards', title: 'Payment cards', description: 'Debit and credit cards with freeze and report-lost actions', category: 'banking', icon: 'CreditCard',
    props: { type: 'object', properties: { title: str('Title'), source: source(), freezeJourney: { ...JOURNEY, title: 'Freeze / unfreeze journey' }, lostJourney: { ...JOURNEY, title: 'Report lost journey' } } },
    defaults: { title: 'Your cards', source: 'records:cards', freezeJourney: '', lostJourney: '' },
    sources: fromProp('source'),
  },
  // process
  {
    type: 'quick-actions', title: 'Quick actions', description: 'Buttons that start journeys or open pages', category: 'process', icon: 'Zap',
    props: { type: 'object', properties: { title: str('Title'), actions: { type: 'array', title: 'Actions', items: { type: 'object', properties: { label: str('Label'), icon: ICON, ...LINK_PROPS } } } } },
    defaults: { title: '', actions: [] },
    sources: () => ['journeys'],
  },
  {
    type: 'journeys', title: 'Journey launcher', description: 'The journeys the client may start (eligibility applied)', category: 'process', icon: 'Rocket',
    props: { type: 'object', properties: { title: str('Title'), category: str('Only this category'), layout: { type: 'string', title: 'Layout', enum: ['grid', 'list'], 'x-enum-labels': ['Cards', 'List'] } } },
    defaults: { title: 'What would you like to do?', layout: 'grid' },
    sources: () => ['journeys'],
  },
  {
    type: 'button', title: 'Button', description: 'Starts a journey (as a page, a dialog, a sheet or full screen), opens a page or a web address', category: 'process', icon: 'MousePointerClick',
    props: {
      type: 'object', properties: {
        label: str('Label'), icon: ICON,
        style: { type: 'string', title: 'Style', enum: ['primary', 'secondary', 'outline', 'accent', 'ghost'], 'x-enum-labels': ['Primary', 'Secondary', 'Outline', 'Accent colour', 'Text only'] },
        size: { type: 'string', title: 'Size', enum: ['sm', 'md', 'lg'], 'x-enum-labels': ['Small', 'Medium', 'Large'] },
        width: { type: 'string', title: 'Width', enum: ['auto', 'full'], 'x-enum-labels': ['Fits the label', 'Full width'] },
        align: { type: 'string', title: 'Alignment', enum: ['left', 'center', 'right'], 'x-enum-labels': ['Left', 'Centre', 'Right'] },
        ...LINK_PROPS, url: str('Web address (https)'),
      },
    },
    defaults: { label: 'Continue', style: 'primary' },
  },
  {
    type: 'fab', title: 'Floating button', description: 'A round button floating over the page (e.g. “Pay with QR”), usually opening a journey as a sheet or full screen', category: 'process', icon: 'CirclePlus',
    props: {
      type: 'object', properties: {
        label: str('Label', 'shown next to the icon; empty: icon only'), icon: ICON,
        position: { type: 'string', title: 'Position', enum: ['bottom-right', 'bottom-center', 'bottom-left'], 'x-enum-labels': ['Bottom right', 'Bottom centre', 'Bottom left'] },
        color: { type: 'string', title: 'Colour', enum: ['primary', 'accent'], 'x-enum-labels': ['Brand colour', 'Accent colour'] },
        ...LINK_PROPS,
      },
    },
    defaults: { label: 'Pay', icon: 'scan-line', position: 'bottom-right', color: 'primary', presentation: 'fullscreen' },
  },
  {
    type: 'qr-code', title: 'QR code', description: 'A QR code to be scanned: a payment request to receive money, a reference, a link', category: 'content', icon: 'QrCode',
    props: {
      type: 'object', properties: {
        title: str('Title'), text: expr('Caption'),
        kind: { type: 'string', title: 'Contents', enum: ['text', 'emv', 'epc'], 'x-enum-labels': ['A text or link', 'EMV payment request (Pix and others)', 'SEPA transfer (EPC)'] },
        value: expr('Text or link', 'for "A text or link", e.g. = \'https://bank.example/pay/\' & me.externalId'),
        name: expr('Payee name'), account: expr('Account (key, IBAN…)'), accountScheme: str('EMV: account scheme', 'e.g. br.gov.bcb.pix'),
        city: expr('EMV: city'), country: str('EMV: country (2 letters)'), amount: expr('Amount (empty: the payer chooses)'), currency: str('Currency'), reference: expr('Reference'),
        size: { type: 'number', title: 'Size (px)' },
      },
    },
    defaults: { title: 'Receive money', kind: 'text', value: '= me.email', size: 200 },
  },
  {
    type: 'applications', title: 'My applications', description: 'Journeys and applications in progress, with their stage', category: 'process', icon: 'FolderKanban',
    props: { type: 'object', properties: { title: str('Title'), limit: { type: 'number', title: 'Show at most' }, empty: str('When empty') } },
    defaults: { title: 'Your applications', limit: 5, empty: 'No applications yet.' },
    sources: () => ['cases'],
  },
  {
    type: 'requests', title: 'Requests', description: 'What the institution is waiting for', category: 'process', icon: 'BellRing',
    props: { type: 'object', properties: { title: str('Title'), empty: str('When empty') } },
    defaults: { title: 'Waiting for you', empty: 'Nothing is waiting for you.' },
    sources: () => ['requests'],
  },
  {
    type: 'notifications', title: 'Notifications', description: 'Messages from the institution', category: 'process', icon: 'Inbox',
    props: { type: 'object', properties: { title: str('Title'), limit: { type: 'number', title: 'Show at most' } } },
    defaults: { title: 'Notifications', limit: 10 },
    sources: () => ['notifications'],
  },
  // profile
  {
    type: 'profile', title: 'Profile', description: 'Personal details; editable fields can be changed by the client', category: 'profile', icon: 'UserRound',
    props: { type: 'object', properties: { title: str('Title'), fields: { type: 'array', title: 'Fields (empty = all profile fields)', items: { type: 'string' } } } },
    defaults: { title: 'Personal details' },
    sources: () => ['me'],
  },
  {
    type: 'security', title: 'Sign-in and security', description: 'Change password, sign out', category: 'profile', icon: 'KeyRound',
    props: { type: 'object', properties: { title: str('Title') } }, defaults: { title: 'Sign-in and security' },
    sources: () => ['me'],
  },
  {
    type: 'privacy', title: 'Privacy and data', description: 'Copy or erasure of personal data, consents given', category: 'profile', icon: 'ShieldCheck',
    props: { type: 'object', properties: { title: str('Title') } }, defaults: { title: 'Your data' },
    sources: () => ['me'],
  },
  // embed
  {
    type: 'embed', title: 'Embedded page', description: 'A page of yours shown in a sandboxed frame (https only)', category: 'embed', icon: 'AppWindow',
    props: { type: 'object', required: ['url'], properties: { title: str('Title (for screen readers)'), url: str('Address (https)'), height: { type: 'number', title: 'Height (px)' } } },
    defaults: { title: 'Embedded page', url: '', height: 480 },
  },
];

export const CLIENT_WIDGET_TYPES = CLIENT_WIDGETS.map((w) => w.type);
export const clientWidgetDefinition = (type: string) => CLIENT_WIDGETS.find((w) => w.type === type);

/** Every widget of a page, depth first. */
export function walkWidgets(widgets: ClientWidget[], visit: (widget: ClientWidget, path: string) => void, path = '') {
  widgets.forEach((widget, index) => {
    const here = `${path}${path ? '.' : ''}${index}`;
    visit(widget, here);
    if (widget.children?.length) walkWidgets(widget.children, visit, here);
  });
}

/** Sources a page reads (its widgets' sources, plus `me` which every page has). */
export function pageSources(page: Pick<ClientPage, 'widgets'> & { title?: string; description?: string }): string[] {
  const sources = new Set<string>(['me']);
  // The title may be an expression, e.g. the name of the account the page shows.
  for (const text of [page.title, page.description]) {
    if (typeof text === 'string') for (const match of text.matchAll(/records\.([a-z][a-z0-9_-]*)/g)) sources.add(`records:${match[1]}`);
  }
  walkWidgets(page.widgets, (widget) => {
    for (const s of clientWidgetDefinition(widget.type)?.sources?.(widget.props) ?? []) sources.add(s);
    for (const value of Object.values(widget.props)) {
      // Expressions may read collections: `= $sum(records.accounts.balance)`.
      if (typeof value === 'string') for (const match of value.matchAll(/records\.([a-z][a-z0-9_-]*)/g)) sources.add(`records:${match[1]}`);
    }
    if (widget.visibleIf) for (const match of widget.visibleIf.matchAll(/records\.([a-z][a-z0-9_-]*)/g)) sources.add(`records:${match[1]}`);
  });
  return [...sources];
}

/** Sources the whole app may read: what the API allows a signed-in client to ask for. */
export function appSources(definition: ClientAppDefinition): string[] {
  const sources = new Set<string>(BUILTIN_SOURCES);
  for (const collection of definition.collections) sources.add(`records:${collection.key}`);
  return [...sources];
}

// --- validation --------------------------------------------------------------------------------------------------------

export interface ClientAppValidationContext {
  /** Workflows of the institution with their published state. */
  workflows: Array<{ id: string; name: string; active: boolean }>;
  /** Syntax check of a JSONata expression (message, or null when fine); the API and the studio pass JSONata's parser. */
  checkExpression?: (source: string) => string | null;
}

/** Every expression of the app with where it is: rules (visibleIf, eligibility, filters), `= …` values, `{{ … }}` placeholders. */
export function appExpressions(app: ClientAppDefinition): Array<{ where: string; source: string }> {
  const found: Array<{ where: string; source: string }> = [];
  const rule = (where: string, value: unknown) => { if (typeof value === 'string' && value.trim()) found.push({ where, source: value.trim().replace(/^=\s*/, '') }); };
  const text = (where: string, value: unknown) => {
    if (typeof value !== 'string') return;
    if (value.trim().startsWith('=')) return rule(where, value);
    for (const match of value.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) found.push({ where, source: match[1].replace(/\|\s*[a-z]+\s*$/, '').trim() });
  };
  const values = (where: string, value: unknown, key = ''): void => {
    if (key === 'filter') return rule(where, value);
    if (typeof value === 'string') return text(where, value);
    if (Array.isArray(value)) return value.forEach((item) => values(where, item));
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) values(where, v, k);
  };
  for (const item of app.navigation) rule(`menu "${item.label}"`, item.visibleIf);
  for (const [key, journey] of Object.entries(app.journeys)) rule(`journey "${key}" (who may start it)`, journey.eligibility);
  for (const [pageKey, page] of Object.entries(app.pages)) {
    rule(`page "${pageKey}"`, page.visibleIf);
    text(`page "${pageKey}" (title)`, page.title);
    walkWidgets(page.widgets, (widget) => {
      const where = `page "${pageKey}", widget "${typeof widget.props.title === 'string' && widget.props.title ? widget.props.title : widget.type}"`;
      rule(where, widget.visibleIf);
      values(where, widget.props);
    });
  }
  return found;
}

/** Problems that prevent publishing (empty = ready). Also run by the studio as you edit. */
export function validateClientApp(raw: unknown, context: ClientAppValidationContext): string[] {
  const parsed = clientAppDefinitionSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join('.') || 'definition'}: ${issue.message}`);
  const app = parsed.data;
  const errors: string[] = [];
  const pages = new Set(Object.keys(app.pages));
  const journeys = new Set(Object.keys(app.journeys));
  const collections = new Set(app.collections.map((c) => c.key));
  const allowedSources = new Set(appSources(app));

  if (!pages.has(app.home)) errors.push(`home page "${app.home}" does not exist`);
  for (const item of app.navigation) if (!pages.has(item.page)) errors.push(`navigation "${item.label}" opens the unknown page "${item.page}"`);
  for (const [journeyKey, journey] of Object.entries(app.journeys)) {
    const workflow = context.workflows.find((w) => w.id === journey.workflowId);
    if (!workflow) errors.push(`journey "${journeyKey}" runs a workflow that does not exist`);
    else if (!workflow.active) errors.push(`journey "${journeyKey}" runs "${workflow.name}", which is not published`);
    if (journey.donePage && !pages.has(journey.donePage)) errors.push(`journey "${journeyKey}" ends on the unknown page "${journey.donePage}"`);
  }
  const keys = new Set<string>();
  for (const field of app.profile.fields) {
    if (keys.has(field.key)) errors.push(`profile field "${field.key}" is declared twice`);
    keys.add(field.key);
  }
  for (const field of app.registration.fields) if (!keys.has(field) && !['name', 'email'].includes(field)) errors.push(`sign-up asks for "${field}", which is not a profile field`);
  if (context.checkExpression) {
    for (const { where, source } of appExpressions(app)) {
      if (/(^|[^$\w.])not\s*\(/.test(source)) errors.push(`${where}: use $not(…) — JSONata functions start with $`);
      const problem = context.checkExpression(source);
      if (problem) errors.push(`${where}: ${problem} in "${source.length > 60 ? `${source.slice(0, 57)}…` : source}"`);
    }
  }
  for (const key of ['primary', 'accent', 'background'] as const) {
    const value = app.theme[key];
    if (value && !/^#[0-9a-f]{6}$/i.test(value)) errors.push(`theme: the ${key} colour must be a hex colour like #1d4ed8 (got "${value}")`);
  }
  for (const origin of app.embed.allowedOrigins) {
    if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) && !/^http:\/\/([a-z0-9-]+\.)*localhost(:\d+)?$/i.test(origin)) errors.push(`embedding: "${origin}" is not a site origin (https://host[:port])`);
  }
  if (app.identity.tokenExchange.enabled) {
    if (!/^https?:\/\//.test(app.identity.tokenExchange.issuer)) errors.push('token exchange needs the issuer URL of your identity provider');
    if (!/^https?:\/\//.test(app.identity.tokenExchange.jwksUri)) errors.push('token exchange needs the JWKS URL of your identity provider');
  }

  for (const [pageKey, page] of Object.entries(app.pages)) {
    const ids = new Set<string>();
    walkWidgets(page.widgets, (widget) => {
      const where = `page "${pageKey}", widget "${widget.props.title ?? widget.type}"`;
      if (ids.has(widget.id)) errors.push(`${where}: duplicate widget id ${widget.id}`);
      ids.add(widget.id);
      const definition = clientWidgetDefinition(widget.type);
      if (!definition) return errors.push(`${where}: unknown widget type "${widget.type}"`);
      if (widget.children?.length && !definition.container) errors.push(`${where}: only sections hold other widgets`);
      for (const required of definition.props.required ?? []) {
        if (widget.props[required] === undefined || widget.props[required] === '') errors.push(`${where}: needs ${definition.props.properties?.[required]?.title ?? required}`);
      }
      for (const s of definition.sources?.(widget.props) ?? []) {
        if (!allowedSources.has(s)) errors.push(`${where}: reads "${s}", which is not a declared collection`);
      }
      const links: Array<Record<string, unknown>> = [widget.props, ...(Array.isArray(widget.props.actions) ? widget.props.actions as Array<Record<string, unknown>> : [])];
      for (const link of links) {
        if (typeof link.page === 'string' && link.page && !pages.has(link.page)) errors.push(`${where}: opens the unknown page "${link.page}"`);
        if (typeof link.journey === 'string' && link.journey && !journeys.has(link.journey)) errors.push(`${where}: starts the unknown journey "${link.journey}"`);
      }
      for (const prop of ['freezeJourney', 'lostJourney']) {
        const value = widget.props[prop];
        if (typeof value === 'string' && value && !journeys.has(value)) errors.push(`${where}: starts the unknown journey "${value}"`);
      }
      if (widget.type === 'embed' || widget.type === 'image') {
        const url = String(widget.props.url ?? '');
        if (url && !/^https:\/\//.test(url) && !/^http:\/\/localhost(:\d+)?\//.test(url)) errors.push(`${where}: the address must start with https://`);
      }
    });
    for (const s of pageSources(page)) {
      if (!allowedSources.has(s) && !s.startsWith('records:')) errors.push(`page "${pageKey}" reads the unknown source "${s}"`);
      if (s.startsWith('records:') && !collections.has(recordCollectionOf(s))) errors.push(`page "${pageKey}" reads "${s}", which is not a declared collection`);
    }
  }
  return [...new Set(errors)];
}

/** A minimal app an institution starts from (the studio's "blank app"). */
export const BLANK_CLIENT_APP: ClientAppDefinition = clientAppDefinitionSchema.parse({
  name: 'Client app',
  home: 'home',
  navigation: [{ page: 'home', label: 'Home', icon: 'house' }, { page: 'activity', label: 'Activity', icon: 'list-checks' }, { page: 'profile', label: 'Profile', icon: 'user-round' }],
  pages: {
    home: {
      title: 'Home', hideTitle: true, widgets: [
        { id: 'w-hero', type: 'hero', props: { eyebrow: 'Welcome back', title: 'Hello {{me.firstName}}', subtitle: 'What would you like to do today?', art: 'welcome' } },
        { id: 'w-requests', type: 'requests', props: { title: 'Waiting for you', empty: 'Nothing is waiting for you.' } },
        { id: 'w-journeys', type: 'journeys', props: { title: 'Start something new', layout: 'grid' } },
      ],
    },
    activity: { title: 'Activity', widgets: [{ id: 'w-apps', type: 'applications', props: { title: 'Your applications', limit: 20 } }, { id: 'w-notes', type: 'notifications', props: { title: 'Notifications', limit: 20 } }] },
    profile: { title: 'Profile', widgets: [{ id: 'w-profile', type: 'profile', props: { title: 'Personal details' } }, { id: 'w-security', type: 'security', props: {} }, { id: 'w-privacy', type: 'privacy', props: {} }] },
  },
});
