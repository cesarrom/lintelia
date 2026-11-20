/**
 * The institution's own back office (docs/plans/16): brand-new pages, menu items and actions for the team, and
 * additions to the built-in pages (buttons and tabs on the client and case pages, widgets on the dashboard) — never a
 * replacement of a built-in page. Every item can carry an access rule (docs/plans/15 §5.2); the API serves the
 * definition pruned for each member and re-checks everything on use. Shared by the API (validation, pruning, data
 * allow-list), the web runtime and the studio's back-office mode.
 */
import { z } from 'zod';
import { CLIENT_WIDGETS, type ClientWidget, type ClientWidgetDefinition } from './client-app.schema';
import type { AccessRule } from './authorization.schema';

const key = z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/, 'lower-case letters, digits, - and _ (starts with a letter)');

export const accessRuleSchema = z.object({
  permissions: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  when: z.string().optional(),
}).strict();

export interface BackOfficeWidget extends ClientWidget {
  /** Who sees the widget (the API removes it for everyone else). */
  access?: AccessRule;
  children?: BackOfficeWidget[];
}

export const backOfficeWidgetSchema: z.ZodType<BackOfficeWidget> = z.lazy(() => z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  props: z.record(z.string(), z.unknown()).default({}),
  visibleIf: z.string().optional(),
  access: accessRuleSchema.optional(),
  children: z.array(backOfficeWidgetSchema).optional(),
})) as z.ZodType<BackOfficeWidget>;

/** What a page is about: nothing, one client (the client page's tabs), one case (the case page's tabs). */
export const PAGE_CONTEXTS = ['none', 'client', 'case'] as const;
export type PageContext = (typeof PAGE_CONTEXTS)[number];

export const backOfficePageSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  context: z.enum(PAGE_CONTEXTS).default('none'),
  access: accessRuleSchema.optional(),
  widgets: z.array(backOfficeWidgetSchema).default([]),
});
export type BackOfficePage = z.infer<typeof backOfficePageSchema>;

/**
 * An action: a named entry point that starts a workflow (its staff screens open over the page), with inputs taken from
 * the context (`{{client.id}}`, `{{case.reference}}`…) and from the button (allow-listed by `inputs`). Both the action's
 * rule and the workflow's own start rule apply.
 */
export const backOfficeActionSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  workflowId: z.string().uuid(),
  context: z.enum(PAGE_CONTEXTS).default('none'),
  /** Case input name → template over the context, e.g. `{ clientEmail: "{{client.email}}" }`. */
  input: z.record(z.string(), z.string()).default({}),
  /** Input keys a button may pass (e.g. the transaction to refund); anything else is dropped. */
  inputs: z.array(z.string()).default([]),
  presentation: z.object({ mode: z.enum(['dialog', 'sheet']).default('dialog'), size: z.enum(['sm', 'md', 'lg']).optional() }).default({}),
  access: accessRuleSchema.optional(),
});
export type BackOfficeAction = z.infer<typeof backOfficeActionSchema>;

/** Built-in pages the back office can place in its menu, choose as a home and link to. */
export const BUILTIN_PAGES = {
  dashboard: { label: 'Dashboard', path: '/app/dashboard' },
  tasks: { label: 'Tasks', path: '/app/tasks' },
  cases: { label: 'Cases', path: '/app/cases' },
  clients: { label: 'Clients', path: '/app/clients' },
} as const;
export type BuiltinPage = keyof typeof BUILTIN_PAGES;

const navItemSchema = z.object({
  /** A section of the menu: an existing one ("Work", "Administration"…) or a new one. */
  section: z.string().min(1).default('Work'),
  label: z.string().min(1),
  icon: z.string().optional(),
  page: key.optional(),
  action: key.optional(),
  access: accessRuleSchema.optional(),
});

const actionRefSchema = z.object({ action: key, access: accessRuleSchema.optional() });
const tabRefSchema = z.object({ page: key, label: z.string().min(1), access: accessRuleSchema.optional() });

export const SLOTS = ['dashboard', 'client.actions', 'client.tabs', 'case.actions', 'case.tabs'] as const;

export const backOfficeDefinitionSchema = z.object({
  schemaVersion: z.literal('1').default('1'),
  name: z.string().min(1).default('Back office'),
  navigation: z.array(navItemSchema).default([]),
  pages: z.record(key, backOfficePageSchema).default({}),
  actions: z.record(key, backOfficeActionSchema).default({}),
  /** Additions to the built-in pages (never replacements). */
  slots: z.object({
    dashboard: z.array(backOfficeWidgetSchema).default([]),
    client: z.object({ actions: z.array(actionRefSchema).default([]), tabs: z.array(tabRefSchema).default([]) }).default({}),
    case: z.object({ actions: z.array(actionRefSchema).default([]), tabs: z.array(tabRefSchema).default([]) }).default({}),
  }).default({}),
  /** Where members land after signing in: the first home whose rule they pass (else the dashboard). */
  homes: z.array(z.object({ page: key.optional(), builtin: z.enum(['dashboard', 'tasks', 'cases', 'clients']).optional(), access: accessRuleSchema.optional() })).default([]),
  pageOrder: z.array(z.string()).optional(),
  actionOrder: z.array(z.string()).optional(),
});
export type BackOfficeDefinition = z.infer<typeof backOfficeDefinitionSchema>;

export const BLANK_BACK_OFFICE: BackOfficeDefinition = backOfficeDefinitionSchema.parse({});

// --- widgets and data ----------------------------------------------------------------------------------------------------

/** Client-app widgets that mean the same in the back office (one renderer, two themes). */
export const BACK_OFFICE_WIDGET_TYPES = ['section', 'heading', 'text', 'callout', 'image', 'stat', 'list', 'table', 'details', 'chart', 'progress-list', 'button', 'embed'];

const SOURCE_DESCRIPTION = 'member, cases, tasks, metrics, client / case (context pages), or records:<collection>';
/** Widgets of the back office (the client-app definitions, with the back office's sources). */
export const BACK_OFFICE_WIDGETS: ClientWidgetDefinition[] = CLIENT_WIDGETS.filter((w) => BACK_OFFICE_WIDGET_TYPES.includes(w.type)).map((w) => {
  const properties = { ...(w.props.properties ?? {}) };
  if (properties.source) properties.source = { ...properties.source, description: SOURCE_DESCRIPTION };
  // Buttons and links start the back office's actions (they are its "journeys"); the action says how its screens open.
  if (properties.journey) properties.journey = { ...properties.journey, title: 'Action', 'x-widget': 'journey' };
  delete properties.presentation;
  if (properties.input) properties.input = { ...properties.input, title: 'Action input', description: 'values passed to the action — only the keys it allows (its "inputs"); templates over the item allowed' };
  return { ...w, props: { ...w.props, properties }, defaults: { ...w.defaults, ...(w.type === 'details' ? { source: 'member' } : {}), ...(properties.source && w.type !== 'details' ? { source: 'cases' } : {}) } };
});
export const backOfficeWidgetDefinition = (type: string) => BACK_OFFICE_WIDGETS.find((w) => w.type === type);

/**
 * What back-office pages read, resolved by the API under the member (permissions, case scope, workflow rules):
 *  `member` (me), `cases`, `tasks` (mine and my queues), `metrics` (counts), `client` / `case` (the page's context),
 *  `records:<collection>` (of the client in context, or across clients).
 */
export const BACK_OFFICE_SOURCES = ['member', 'cases', 'tasks', 'metrics', 'client', 'case'] as const;

/** Permissions a source needs (a widget reading it shows nothing to members without them). */
export const SOURCE_PERMISSIONS: Record<string, string[][]> = {
  member: [],
  cases: [['cases:read']],
  tasks: [['tasks:work'], ['tasks:assign']],
  metrics: [],
  client: [['clients:read']],
  case: [['cases:read']],
  records: [['clients:read']],
};

export const isBackOfficeSource = (source: string) => (BACK_OFFICE_SOURCES as readonly string[]).includes(source) || /^records:[a-z][a-z0-9_-]{0,47}$/.test(source);
export const sourceFamily = (source: string) => (source.startsWith('records:') ? 'records' : source);

export function walkBackOfficeWidgets(widgets: BackOfficeWidget[], visit: (widget: BackOfficeWidget, path: string) => void, path = '') {
  widgets.forEach((widget, index) => {
    const here = `${path}${path ? '.' : ''}${index}`;
    visit(widget, here);
    if (widget.children?.length) walkBackOfficeWidgets(widget.children, visit, here);
  });
}

/** Sources a list of widgets reads: their `source` props and what their expressions mention. */
export function widgetsSources(widgets: BackOfficeWidget[], extra: string[] = []): string[] {
  const sources = new Set<string>(['member']);
  const scan = (text: unknown) => {
    if (typeof text !== 'string') return;
    for (const match of text.matchAll(/records\.([a-z][a-z0-9_-]*)/g)) sources.add(`records:${match[1]}`);
    for (const match of text.matchAll(/(?<![\w.$])(cases|tasks|metrics|client|case|member)(?![\w])/g)) sources.add(match[1]);
  };
  for (const text of extra) scan(text);
  walkBackOfficeWidgets(widgets, (widget) => {
    for (const [name, value] of Object.entries(widget.props)) {
      if (name === 'source' && typeof value === 'string' && value) sources.add(value);
      else if (typeof value === 'string') scan(value);
      else if (value && typeof value === 'object') scan(JSON.stringify(value));
    }
    scan(widget.visibleIf);
  });
  return [...sources].filter(isBackOfficeSource);
}

export const backOfficePageSources = (page: BackOfficePage) =>
  [...new Set([...widgetsSources(page.widgets, [page.title, page.description ?? '']), ...(page.context !== 'none' ? [page.context] : [])])];

// --- validation --------------------------------------------------------------------------------------------------------

export interface BackOfficeValidationContext {
  workflows: Array<{ id: string; name: string; active: boolean }>;
  permissions: readonly string[];
  roles: readonly string[];
  checkExpression?: (source: string) => string | null;
}

const ruleErrors = (rule: AccessRule | undefined, where: string, context: BackOfficeValidationContext) => {
  const errors: string[] = [];
  for (const p of rule?.permissions ?? []) if (!context.permissions.includes(p)) errors.push(`${where}: unknown permission "${p}"`);
  for (const r of rule?.roles ?? []) if (!context.roles.includes(r)) errors.push(`${where}: unknown role "${r}"`);
  if (rule?.when && context.checkExpression) {
    const problem = context.checkExpression(rule.when.replace(/^\s*=/, ''));
    if (problem) errors.push(`${where}: the condition is not valid JSONata (${problem})`);
  }
  return errors;
};

/** Problems that prevent publishing (empty = ready). Also run by the studio as you edit. */
export function validateBackOffice(raw: unknown, context: BackOfficeValidationContext): string[] {
  const parsed = backOfficeDefinitionSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join('.') || 'definition'}: ${issue.message}`);
  const app = parsed.data;
  const errors: string[] = [];
  const pages = app.pages;
  const actions = app.actions;

  for (const [actionKey, action] of Object.entries(actions)) {
    const where = `action "${action.label}"`;
    const workflow = context.workflows.find((w) => w.id === action.workflowId);
    if (!workflow) errors.push(`${where} runs a workflow that does not exist`);
    else if (!workflow.active) errors.push(`${where} runs "${workflow.name}", which is not published`);
    errors.push(...ruleErrors(action.access, where, context));
    for (const [name, template] of Object.entries(action.input)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) errors.push(`${where}: input "${name}" must be letters, digits and _`);
      for (const match of template.matchAll(/\{\{\s*([a-z]+)\./g)) {
        if (['client', 'case'].includes(match[1]) && match[1] !== action.context) errors.push(`${where}: input "${name}" reads ${match[1]}, but the action is not on a ${match[1]} page`);
      }
    }
    void actionKey;
  }

  const pageOf = (k: string, where: string) => {
    if (!pages[k]) errors.push(`${where} opens the unknown page "${k}"`);
    return pages[k];
  };
  const actionOf = (k: string, where: string) => {
    if (!actions[k]) errors.push(`${where} runs the unknown action "${k}"`);
    return actions[k];
  };

  for (const item of app.navigation) {
    const where = `menu "${item.label}"`;
    if (!!item.page === !!item.action) errors.push(`${where} must open a page or run an action`);
    if (item.page) {
      const page = pageOf(item.page, where);
      if (page && page.context !== 'none') errors.push(`${where}: "${page.title}" is about a ${page.context}, it belongs in the ${page.context} page's tabs`);
    }
    if (item.action) {
      const action = actionOf(item.action, where);
      if (action && action.context !== 'none') errors.push(`${where}: "${action.label}" needs a ${action.context}: put it on the ${action.context} page`);
    }
    errors.push(...ruleErrors(item.access, where, context));
  }
  for (const home of app.homes) {
    if (!!home.page === !!home.builtin) errors.push('each home is a page or a built-in page');
    if (home.page) pageOf(home.page, 'a home');
    errors.push(...ruleErrors(home.access, 'a home', context));
  }
  for (const scope of ['client', 'case'] as const) {
    for (const ref of app.slots[scope].actions) {
      const where = `the ${scope} page's button "${ref.action}"`;
      const action = actionOf(ref.action, where);
      if (action && action.context !== scope) errors.push(`${where}: the action "${action.label}" is not about a ${scope}`);
      errors.push(...ruleErrors(ref.access, where, context));
    }
    for (const tab of app.slots[scope].tabs) {
      const where = `the ${scope} page's tab "${tab.label}"`;
      const page = pageOf(tab.page, where);
      if (page && page.context !== scope) errors.push(`${where}: the page "${page.title}" is not about a ${scope}`);
      errors.push(...ruleErrors(tab.access, where, context));
    }
  }

  const checkWidgets = (widgets: BackOfficeWidget[], where: string, pageContext: PageContext) => {
    const ids = new Set<string>();
    walkBackOfficeWidgets(widgets, (widget) => {
      const at = `${where}, widget "${typeof widget.props.title === 'string' && widget.props.title ? widget.props.title : widget.type}"`;
      if (ids.has(widget.id)) errors.push(`${at}: duplicate widget id ${widget.id}`);
      ids.add(widget.id);
      const definition = backOfficeWidgetDefinition(widget.type);
      if (!definition) return void errors.push(`${at}: "${widget.type}" is not a back-office widget`);
      if (widget.children?.length && !definition.container) errors.push(`${at}: only sections hold other widgets`);
      for (const required of definition.props.required ?? []) {
        if (widget.props[required] === undefined || widget.props[required] === '') errors.push(`${at}: needs ${definition.props.properties?.[required]?.title ?? required}`);
      }
      const source = widget.props.source;
      if (typeof source === 'string' && source) {
        if (!isBackOfficeSource(source)) errors.push(`${at}: "${source}" is not a source of the back office (${SOURCE_DESCRIPTION})`);
        if ((source === 'client' || source === 'case') && pageContext !== source) errors.push(`${at}: reads the ${source}, but the page is not about a ${source}`);
      }
      const journey = widget.props.journey;
      if (typeof journey === 'string' && journey) {
        const action = actionOf(journey, at);
        if (action && action.context !== 'none' && action.context !== pageContext) errors.push(`${at}: the action "${action.label}" needs a ${action.context}`);
      }
      const page = widget.props.page;
      if (typeof page === 'string' && page && !page.startsWith('builtin:')) pageOf(page, at);
      errors.push(...ruleErrors(widget.access, at, context));
      if (context.checkExpression) {
        const expressions: string[] = [];
        if (widget.visibleIf) expressions.push(widget.visibleIf);
        for (const [name, value] of Object.entries(widget.props)) {
          if (typeof value !== 'string') continue;
          if (name === 'filter' && value.trim()) expressions.push(value);
          else if (value.trim().startsWith('=')) expressions.push(value);
        }
        for (const expression of expressions) {
          const problem = context.checkExpression(expression.trim().replace(/^=\s*/, ''));
          if (problem) errors.push(`${at}: ${problem} in "${expression.length > 60 ? `${expression.slice(0, 57)}…` : expression}"`);
        }
      }
    });
  };
  for (const [pageKey, page] of Object.entries(pages)) {
    errors.push(...ruleErrors(page.access, `page "${pageKey}"`, context));
    checkWidgets(page.widgets, `page "${pageKey}"`, page.context);
  }
  checkWidgets(app.slots.dashboard, 'the dashboard', 'none');
  return [...new Set(errors)];
}
