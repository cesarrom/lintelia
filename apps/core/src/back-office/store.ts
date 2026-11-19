import { and, desc, eq } from 'drizzle-orm';
import {
  BLANK_BACK_OFFICE, backOfficeDefinitionSchema, type AccessRule, type BackOfficeDefinition, type BackOfficeWidget,
} from '@repo/fintivio/schemas';
import { clientApps, clientAppVersions } from '../entities';
import type { TenantDatabase } from '../clients/database.client';
import { allows, startRuleOf, type RuleSubject } from '../access/rules';

/**
 * Storage of the back office (docs/plans/16): the same draft → versions → active version as the client app, in the same
 * tables under the key `backoffice`.
 */
export const BACK_OFFICE_KEY = 'backoffice';

export async function loadBackOffice(db: TenantDatabase) {
  const [row] = await db.select().from(clientApps).where(eq(clientApps.key, BACK_OFFICE_KEY)).limit(1);
  return row ?? null;
}

export async function saveBackOfficeDraft(db: TenantDatabase, definition: Record<string, unknown>, by: string | null) {
  const existing = await loadBackOffice(db);
  const name = typeof definition.name === 'string' && definition.name.trim() ? definition.name.trim().slice(0, 255) : 'Back office';
  if (existing) {
    const [row] = await db.update(clientApps).set({ draft: definition, name, updatedBy: by }).where(eq(clientApps.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(clientApps).values({ key: BACK_OFFICE_KEY, name, draft: definition, updatedBy: by }).returning();
  return row;
}

export async function publishBackOffice(db: TenantDatabase, appId: string, definition: Record<string, unknown>, by: string | null) {
  const [latest] = await db.select({ version: clientAppVersions.version }).from(clientAppVersions).where(eq(clientAppVersions.appId, appId)).orderBy(desc(clientAppVersions.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;
  await db.insert(clientAppVersions).values({ appId, version, definition, publishedBy: by });
  await db.update(clientApps).set({ activeVersion: version }).where(eq(clientApps.id, appId));
  return version;
}

/** The published definition members get (null when the institution has none). */
export async function activeBackOffice(db: TenantDatabase): Promise<{ version: number; definition: BackOfficeDefinition } | null> {
  const app = await loadBackOffice(db);
  if (!app?.activeVersion) return null;
  const [row] = await db.select().from(clientAppVersions).where(and(eq(clientAppVersions.appId, app.id), eq(clientAppVersions.version, app.activeVersion))).limit(1);
  if (!row) return null;
  const parsed = backOfficeDefinitionSchema.safeParse(row.definition);
  return parsed.success ? { version: row.version, definition: parsed.data } : null;
}

export const blankBackOffice = () => structuredClone(BLANK_BACK_OFFICE) as unknown as Record<string, unknown>;

// --- pruning ---------------------------------------------------------------------------------------------------------

/** Conditions about the page's client or case cannot be decided before there is one: they are checked on use. */
const contextual = (rule: AccessRule | undefined) => !!rule?.when && /(^|[^\w.])(client|case)\./.test(rule.when);

/**
 * The definition as one member may see it (docs/plans/16 §5.8): items, pages, widgets, actions and additions to built-in
 * pages outside the member's rules are removed before anything reaches the browser; actions whose workflow the member
 * may not start are removed too, and so are the buttons and menu items that use removed pages or actions.
 */
export async function pruneBackOffice(db: TenantDatabase, definition: BackOfficeDefinition, subject: RuleSubject): Promise<BackOfficeDefinition> {
  const verdicts = new Map<string, boolean>();
  const allow = async (rule: AccessRule | undefined) => {
    if (!rule) return true;
    const cacheKey = JSON.stringify(rule);
    if (!verdicts.has(cacheKey)) verdicts.set(cacheKey, contextual(rule) ? (await allows({ ...rule, when: undefined }, subject)) : await allows(rule, subject));
    return verdicts.get(cacheKey)!;
  };
  const startable = new Map<string, boolean>();
  const actions: BackOfficeDefinition['actions'] = {};
  for (const [key, action] of Object.entries(definition.actions)) {
    if (!startable.has(action.workflowId)) startable.set(action.workflowId, await allows(await startRuleOf(db, action.workflowId), subject));
    if (startable.get(action.workflowId) && await allow(action.access)) actions[key] = action;
  }
  const pruneWidgets = async (widgets: BackOfficeWidget[]): Promise<BackOfficeWidget[]> => {
    const kept: BackOfficeWidget[] = [];
    for (const widget of widgets) {
      if (!(await allow(widget.access))) continue;
      const journey = widget.props.journey;
      if (typeof journey === 'string' && journey && !actions[journey]) {
        // A button for an action the member may not run disappears; elsewhere only the link goes.
        if (widget.type === 'button') continue;
        const { journey: _drop, input: _input, ...props } = widget.props;
        kept.push({ ...widget, props, ...(widget.children ? { children: await pruneWidgets(widget.children) } : {}) });
        continue;
      }
      kept.push({ ...widget, ...(widget.children ? { children: await pruneWidgets(widget.children) } : {}) });
    }
    return kept;
  };
  const pages: BackOfficeDefinition['pages'] = {};
  for (const [key, page] of Object.entries(definition.pages)) {
    if (await allow(page.access)) pages[key] = { ...page, widgets: await pruneWidgets(page.widgets) };
  }
  const navigation = [];
  for (const item of definition.navigation) {
    if (!(await allow(item.access))) continue;
    if (item.page && !pages[item.page]) continue;
    if (item.action && !actions[item.action]) continue;
    navigation.push(item);
  }
  const refs = async (list: Array<{ action: string; access?: AccessRule }>) => {
    const out = [];
    for (const ref of list) if (actions[ref.action] && await allow(ref.access)) out.push(ref);
    return out;
  };
  const tabs = async (list: Array<{ page: string; label: string; access?: AccessRule }>) => {
    const out = [];
    for (const tab of list) if (pages[tab.page] && await allow(tab.access)) out.push(tab);
    return out;
  };
  const homes = [];
  for (const home of definition.homes) if ((home.builtin || (home.page && pages[home.page])) && await allow(home.access)) homes.push(home);
  return {
    ...definition,
    navigation, pages, actions, homes,
    slots: {
      dashboard: await pruneWidgets(definition.slots.dashboard),
      client: { actions: await refs(definition.slots.client.actions), tabs: await tabs(definition.slots.client.tabs) },
      case: { actions: await refs(definition.slots.case.actions), tabs: await tabs(definition.slots.case.tabs) },
    },
  };
}
