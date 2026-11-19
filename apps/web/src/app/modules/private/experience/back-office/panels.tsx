import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CircleAlert, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { BUILTIN_PAGES, backOfficeWidgetDefinition, type BackOfficeDefinition, type BackOfficeWidget, type JsonSchema } from '@repo/fintivio/schemas';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppIcon } from '@/client-app/icons';
import { AccessRuleEditor, type AccessRule } from '@/components/access/AccessRuleEditor';
import { apiErrorMessage, useApiQuery } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';
import { ObjectFields, type SchemaFormContext } from '../../workflows/components/catalog/SchemaForm';
import { InspectorSection } from '../Inspector';

/**
 * Inspectors and dialogs of the studio's back-office mode (docs/plans/16 §5.9): every item — page, widget, action, menu
 * item, button and tab on a built-in page, home — says who gets it with an access rule (docs/plans/15 §5.2).
 */
export type Definition = BackOfficeDefinition;
const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

const CONTEXT_LABELS = ['Anywhere (its own page, the menu, the dashboard)', 'About one client (a tab of the client page)', 'About one case (a tab of the case page)'];

const PAGE_SCHEMA: JsonSchema = {
  type: 'object', required: ['title'],
  properties: {
    title: { type: 'string', title: 'Title' },
    description: { type: 'string', title: 'Description' },
    icon: { type: 'string', title: 'Icon', 'x-widget': 'icon' },
    context: { type: 'string', title: 'The page is', enum: ['none', 'client', 'case'], 'x-enum-labels': CONTEXT_LABELS },
  },
};

export const ACTION_SCHEMA: JsonSchema = {
  type: 'object', required: ['label', 'workflowId'],
  properties: {
    label: { type: 'string', title: 'Label', description: 'the button and menu text' },
    description: { type: 'string', title: 'Description' },
    icon: { type: 'string', title: 'Icon', 'x-widget': 'icon' },
    workflowId: { type: 'string', title: 'Workflow it starts', description: 'its own start rule applies too', 'x-widget': 'workflowPick' },
    context: { type: 'string', title: 'It runs', enum: ['none', 'client', 'case'], 'x-enum-labels': ['On its own (menu, pages, dashboard)', 'On a client (client page and its tabs)', 'On a case (case page and its tabs)'] },
    input: { type: 'object', title: 'Case input', description: 'name → template over the context, e.g. clientEmail → {{client.email}}, caseRef → {{case.reference}}, by → {{member.email}}', 'x-widget': 'keyValue' },
    inputs: { type: 'array', title: 'Inputs a button may pass', description: 'e.g. the transaction to refund; anything else is dropped', items: { type: 'string' } },
    presentation: {
      type: 'object', title: 'Its screens open',
      properties: {
        mode: { type: 'string', title: 'In', enum: ['dialog', 'sheet'], 'x-enum-labels': ['A dialog over the page', 'A sheet at the side'] },
        size: { type: 'string', title: 'Size', enum: ['sm', 'md', 'lg'], 'x-enum-labels': ['Small', 'Medium', 'Large'] },
      },
    },
  },
};

const NAV_SCHEMA: JsonSchema = {
  type: 'object', required: ['label', 'section'],
  properties: {
    section: { type: 'string', title: 'Section of the menu', description: 'an existing one (Work, Build, Administration) or a new one' },
    label: { type: 'string', title: 'Label' },
    icon: { type: 'string', title: 'Icon', 'x-widget': 'icon' },
    page: { type: 'string', title: 'Opens the page', 'x-widget': 'menuPage' },
    action: { type: 'string', title: 'Or runs the action', 'x-widget': 'menuAction' },
  },
};

/** "Who gets it": the rule editor, with what the default means here. */
function WhoGetsIt({ value, onChange, what, testId }: { value: AccessRule | undefined; onChange: (rule: AccessRule | undefined) => void; what: string; testId?: string }) {
  return (
    <InspectorSection title="Who gets it" description={`Members who do not pass the rule never receive this ${what}; the API checks it again on use.`}>
      <AccessRuleEditor compact label={`Who gets this ${what}`} defaultLabel="Every member" value={value} onChange={onChange} testId={testId} />
    </InspectorSection>
  );
}

// --- widgets -------------------------------------------------------------------------------------------------------------

export function BackOfficeWidgetInspector({ widget, context, onChange, onRemove, readOnly }: { widget: BackOfficeWidget; context: SchemaFormContext; onChange: (widget: BackOfficeWidget) => void; onRemove: () => void; readOnly: boolean }) {
  const definition = backOfficeWidgetDefinition(widget.type);
  return (
    <div data-testid="widget-inspector" data-type={widget.type}>
      <div className="flex items-start gap-3 border-b px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><AppIcon name={definition?.icon} className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{definition?.title ?? widget.type}</p>
          <p className="text-xs leading-snug text-muted-foreground">{definition?.description}</p>
        </div>
        {!readOnly && <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remove widget" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <fieldset disabled={readOnly} className="min-w-0">
        {definition && (
          <InspectorSection title="Content">
            <ObjectFields schema={definition.props} value={widget.props} context={context} onChange={(props) => onChange({ ...widget, props })} />
          </InspectorSection>
        )}
        <WhoGetsIt what="widget" value={widget.access} onChange={(access) => onChange({ ...widget, access })} testId="widget-access" />
        <InspectorSection title="Show only when">
          <Textarea
            id="widget-visible-if" aria-label="Show only when" rows={2} className="font-mono text-xs" placeholder="always" value={widget.visibleIf ?? ''}
            onChange={(e) => onChange({ ...widget, visibleIf: e.target.value.trim() ? e.target.value : undefined })}
          />
          <p className="text-xs text-muted-foreground">JSONata over the page data — e.g. <span className="font-mono">metrics.tasks.mine &gt; 0</span>. Hiding is cosmetic: use “Who gets it” to keep it from members.</p>
          <p className="font-mono text-[11px] text-muted-foreground">id: {widget.id}</p>
        </InspectorSection>
      </fieldset>
    </div>
  );
}

// --- pages ---------------------------------------------------------------------------------------------------------------

/** A page's settings: title, what it is about, who gets it, where it appears (menu entry, or tab of a built-in page). */
export function PageSettings({ definition, pageKey, context, onChange, onDelete, readOnly }: {
  definition: Definition; pageKey: string; context: SchemaFormContext; onChange: (definition: Definition) => void; onDelete: () => void; readOnly: boolean;
}) {
  const page = definition.pages[pageKey];
  if (!page) return null;
  const setPage = (next: typeof page) => {
    // A page changing what it is about leaves the places that no longer fit.
    const moved = next.context !== page.context;
    onChange({
      ...definition,
      pages: { ...definition.pages, [pageKey]: next },
      ...(moved ? {
        navigation: next.context === 'none' ? definition.navigation : definition.navigation.filter((n) => n.page !== pageKey),
        slots: {
          ...definition.slots,
          client: { ...definition.slots.client, tabs: next.context === 'client' ? definition.slots.client.tabs : definition.slots.client.tabs.filter((t) => t.page !== pageKey) },
          case: { ...definition.slots.case, tabs: next.context === 'case' ? definition.slots.case.tabs : definition.slots.case.tabs.filter((t) => t.page !== pageKey) },
        },
      } : {}),
    });
  };
  const nav = definition.navigation.find((n) => n.page === pageKey);
  const scope = page.context === 'none' ? null : page.context;
  const tab = scope ? definition.slots[scope].tabs.find((t) => t.page === pageKey) : undefined;
  const setMenu = (on: boolean) => onChange({
    ...definition,
    navigation: on ? [...definition.navigation, { section: 'Work', label: page.title, icon: page.icon, page: pageKey }] : definition.navigation.filter((n) => n.page !== pageKey),
  });
  const setNav = (change: Partial<NonNullable<typeof nav>>) => onChange({ ...definition, navigation: definition.navigation.map((n) => (n.page === pageKey ? { ...n, ...change } : n)) });
  const setTab = (on: boolean, change: { label?: string } = {}) => {
    if (!scope) return;
    const tabs = definition.slots[scope].tabs;
    const next = on ? (tab ? tabs.map((t) => (t.page === pageKey ? { ...t, ...change } : t)) : [...tabs, { page: pageKey, label: page.title }]) : tabs.filter((t) => t.page !== pageKey);
    onChange({ ...definition, slots: { ...definition.slots, [scope]: { ...definition.slots[scope], tabs: next } } });
  };
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="page-inspector">
      <InspectorSection title="Page" description={scope ? `Shown as a tab of the ${scope} page, with that ${scope}.` : `Address: /app/x/${pageKey}`}>
        <ObjectFields schema={PAGE_SCHEMA} value={page} context={context} onChange={(value) => setPage({ ...page, ...(value as Partial<typeof page>) })} />
      </InspectorSection>
      {!scope && (
        <InspectorSection title="In the menu">
          <label className="flex items-center justify-between gap-3 text-sm">Show it in the menu<Switch checked={!!nav} onCheckedChange={setMenu} aria-label="Show it in the menu" data-testid="page-in-menu" /></label>
          {nav && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label htmlFor="nav-section">Section</Label><Input id="nav-section" value={nav.section} onChange={(e) => setNav({ section: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="nav-label">Label</Label><Input id="nav-label" value={nav.label} onChange={(e) => setNav({ label: e.target.value })} /></div>
            </div>
          )}
          {nav && <p className="text-xs text-muted-foreground">The menu item has its own rule (Menu tab); members without the page’s never get it anyway.</p>}
        </InspectorSection>
      )}
      {scope && (
        <InspectorSection title={`Tab of the ${scope} page`}>
          <label className="flex items-center justify-between gap-3 text-sm">Show it as a tab<Switch checked={!!tab} onCheckedChange={(on) => setTab(on)} aria-label="Show it as a tab" data-testid="page-as-tab" /></label>
          {tab && <div className="space-y-1"><Label htmlFor="tab-label">Tab label</Label><Input id="tab-label" value={tab.label} onChange={(e) => setTab(true, { label: e.target.value })} /></div>}
        </InspectorSection>
      )}
      <WhoGetsIt what="page" value={page.access} onChange={(access) => setPage({ ...page, access })} testId="page-access" />
      <InspectorSection title="Removal">
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete} data-testid="delete-page"><Trash2 className="h-4 w-4" />Delete the page</Button>
        <p className="font-mono text-[11px] text-muted-foreground">key: {pageKey}</p>
      </InspectorSection>
    </fieldset>
  );
}

// --- additions to a built-in page ------------------------------------------------------------------------------------------

/** The buttons and tabs the back office adds to the client (or case) page: pick, order, and say who gets each. */
export function SlotInspector({ definition, scope, onChange, readOnly }: { definition: Definition; scope: 'client' | 'case'; onChange: (definition: Definition) => void; readOnly: boolean }) {
  const slot = definition.slots[scope];
  const actions = Object.entries(definition.actions).filter(([, a]) => a.context === scope);
  const pages = Object.entries(definition.pages).filter(([, p]) => p.context === scope);
  const [open, setOpen] = useState<string | null>(null);
  const setSlot = (next: Partial<typeof slot>) => onChange({ ...definition, slots: { ...definition.slots, [scope]: { ...slot, ...next } } });
  const move = <T,>(list: T[], index: number, direction: -1 | 1) => {
    const next = [...list];
    const target = index + direction;
    if (target < 0 || target >= next.length) return list;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="slot-inspector" data-scope={scope}>
      <InspectorSection title={`Buttons on the ${scope} page`} description={`Actions that run on a ${scope}: next to the page's own buttons.`}>
        {slot.actions.map((ref, i) => (
          <SlotRow key={ref.action} label={definition.actions[ref.action]?.label ?? ref.action} icon={definition.actions[ref.action]?.icon} restricted={!!ref.access}
            open={open === `a:${ref.action}`} onToggle={() => setOpen(open === `a:${ref.action}` ? null : `a:${ref.action}`)}
            onUp={() => setSlot({ actions: move(slot.actions, i, -1) })} onDown={() => setSlot({ actions: move(slot.actions, i, 1) })}
            onRemove={() => setSlot({ actions: slot.actions.filter((a) => a.action !== ref.action) })}>
            <AccessRuleEditor compact label="Who gets this button" defaultLabel="Everyone who may run the action" value={ref.access} onChange={(access) => setSlot({ actions: slot.actions.map((a) => (a.action === ref.action ? { ...a, access } : a)) })} />
          </SlotRow>
        ))}
        <AddPicker
          label="Add a button" empty={actions.length ? `Every action about a ${scope} is here.` : `No action runs on a ${scope} yet (Actions tab).`} testId={`add-${scope}-button`}
          options={actions.filter(([key]) => !slot.actions.some((a) => a.action === key)).map(([key, a]) => ({ value: key, label: a.label }))}
          onPick={(action) => setSlot({ actions: [...slot.actions, { action }] })}
        />
      </InspectorSection>
      <InspectorSection title={`Tabs on the ${scope} page`} description={`Pages about a ${scope}, after the page's own content (“Overview”).`}>
        {slot.tabs.map((ref, i) => (
          <SlotRow key={ref.page} label={ref.label} icon={definition.pages[ref.page]?.icon} restricted={!!ref.access}
            open={open === `t:${ref.page}`} onToggle={() => setOpen(open === `t:${ref.page}` ? null : `t:${ref.page}`)}
            onUp={() => setSlot({ tabs: move(slot.tabs, i, -1) })} onDown={() => setSlot({ tabs: move(slot.tabs, i, 1) })}
            onRemove={() => setSlot({ tabs: slot.tabs.filter((t) => t.page !== ref.page) })}>
            <div className="space-y-1"><Label htmlFor={`tab-${ref.page}`}>Label</Label><Input id={`tab-${ref.page}`} value={ref.label} onChange={(e) => setSlot({ tabs: slot.tabs.map((t) => (t.page === ref.page ? { ...t, label: e.target.value } : t)) })} /></div>
            <AccessRuleEditor compact label="Who gets this tab" defaultLabel="Everyone who gets the page" value={ref.access} onChange={(access) => setSlot({ tabs: slot.tabs.map((t) => (t.page === ref.page ? { ...t, access } : t)) })} />
          </SlotRow>
        ))}
        <AddPicker
          label="Add a tab" empty={pages.length ? `Every page about a ${scope} is here.` : `No page is about a ${scope} yet: add one and choose “About one ${scope}”.`} testId={`add-${scope}-tab`}
          options={pages.filter(([key]) => !slot.tabs.some((t) => t.page === key)).map(([key, p]) => ({ value: key, label: p.title }))}
          onPick={(page) => setSlot({ tabs: [...slot.tabs, { page, label: definition.pages[page].title }] })}
        />
      </InspectorSection>
    </fieldset>
  );
}

function SlotRow({ label, icon, restricted, open, onToggle, onUp, onDown, onRemove, children }: {
  label: string; icon?: string; restricted: boolean; open: boolean; onToggle: () => void; onUp: () => void; onDown: () => void; onRemove: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border" data-testid="slot-row">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <AppIcon name={icon} fallback="square" className="h-4 w-4 shrink-0 opacity-70" />
        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm" onClick={onToggle}>{label}</button>
        {restricted && <Lock className="h-3.5 w-3.5 opacity-50" aria-label="Only for some members" />}
        <button type="button" aria-label="Earlier" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={onUp}><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Later" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={onDown}><ArrowDown className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Remove" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      {open && <div className="space-y-3 border-t p-2.5">{children}</div>}
    </div>
  );
}

function AddPicker({ label, options, onPick, empty, testId }: { label: string; options: Array<{ value: string; label: string }>; onPick: (value: string) => void; empty: string; testId?: string }) {
  if (!options.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <select aria-label={label} data-testid={testId} value="" onChange={(e) => e.target.value && onPick(e.target.value)} className="h-8 w-full rounded-md border border-dashed border-input bg-background px-2 text-sm text-muted-foreground">
      <option value="">+ {label}…</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// --- actions -------------------------------------------------------------------------------------------------------------

/** Where an action appears: menu items, buttons of built-in pages, widgets. */
export function actionUses(definition: Definition, key: string) {
  const uses: string[] = [];
  for (const n of definition.navigation) if (n.action === key) uses.push(`menu “${n.label}”`);
  for (const scope of ['client', 'case'] as const) if (definition.slots[scope].actions.some((a) => a.action === key)) uses.push(`button on the ${scope} page`);
  const scan = (widgets: BackOfficeWidget[], where: string) => {
    for (const w of widgets) {
      if (w.props.journey === key) uses.push(`${w.type} on ${where}`);
      if (w.children) scan(w.children, where);
    }
  };
  for (const [, page] of Object.entries(definition.pages)) scan(page.widgets, `“${page.title}”`);
  scan(definition.slots.dashboard, 'the dashboard');
  return uses;
}

export function ActionInspector({ definition, actionKey, context, workflows, onChange, onDelete, readOnly }: {
  definition: Definition; actionKey: string; context: SchemaFormContext; workflows: Array<{ id: string; name: string; active: boolean }>;
  onChange: (definition: Definition) => void; onDelete: () => void; readOnly: boolean;
}) {
  const action = definition.actions[actionKey];
  if (!action) return null;
  const set = (next: typeof action) => onChange({ ...definition, actions: { ...definition.actions, [actionKey]: next } });
  const workflow = workflows.find((w) => w.id === action.workflowId);
  const uses = actionUses(definition, actionKey);
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="action-inspector">
      <InspectorSection title={action.label || 'Action'} description={`Key: ${actionKey}. Starts a workflow; its team.screen steps open over the page for the member who ran it.`}>
        {workflow && !workflow.active && <p className="flex items-center gap-1.5 text-xs text-destructive"><CircleAlert className="h-3.5 w-3.5" />“{workflow.name}” is not published yet.</p>}
        <ObjectFields schema={ACTION_SCHEMA} value={action} context={context} onChange={(value) => set({ ...action, ...(value as Partial<typeof action>) })} />
      </InspectorSection>
      <WhoGetsIt what="action" value={action.access} onChange={(access) => set({ ...action, access })} testId="action-access" />
      <InspectorSection title="Where it appears">
        {uses.length ? <ul className="list-disc space-y-0.5 pl-5 text-sm">{uses.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="text-xs text-muted-foreground">Nowhere yet: add it to the menu, as a button of the {action.context === 'none' ? 'dashboard or a page' : `${action.context} page`}, or to a button widget.</p>}
      </InspectorSection>
      <InspectorSection title="Removal">
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" />Remove the action</Button>
      </InspectorSection>
    </fieldset>
  );
}

// --- menu and homes --------------------------------------------------------------------------------------------------------

export function NavInspector({ definition, index, context, onChange, readOnly }: { definition: Definition; index: number; context: SchemaFormContext; onChange: (definition: Definition) => void; readOnly: boolean }) {
  const item = definition.navigation[index];
  if (!item) return null;
  const set = (next: typeof item) => onChange({ ...definition, navigation: definition.navigation.map((n, i) => (i === index ? next : n)) });
  const move = (direction: -1 | 1) => {
    const list = [...definition.navigation];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    onChange({ ...definition, navigation: list });
  };
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="nav-inspector">
      <InspectorSection title={item.label || 'Menu item'} description="Opens one of your pages (about nothing in particular) or runs an action that needs no client or case.">
        <ObjectFields schema={NAV_SCHEMA} value={item} context={context} onChange={(value) => {
          const next = { ...item, ...(value as Partial<typeof item>) };
          // One or the other: choosing a page clears the action and the reverse.
          if ((value as typeof item).page && (value as typeof item).page !== item.page) next.action = undefined;
          if ((value as typeof item).action && (value as typeof item).action !== item.action) next.page = undefined;
          set(next);
        }} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => move(-1)} disabled={index === 0}><ArrowUp className="h-4 w-4" />Earlier</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => move(1)} disabled={index === definition.navigation.length - 1}><ArrowDown className="h-4 w-4" />Later</Button>
        </div>
      </InspectorSection>
      <WhoGetsIt what="menu item" value={item.access} onChange={(access) => set({ ...item, access })} testId="nav-access" />
      <InspectorSection title="Removal">
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onChange({ ...definition, navigation: definition.navigation.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" />Remove from the menu</Button>
      </InspectorSection>
    </fieldset>
  );
}

/** Where members land after signing in: the first home whose rule they pass (else the dashboard). */
export function HomesInspector({ definition, onChange, readOnly }: { definition: Definition; onChange: (definition: Definition) => void; readOnly: boolean }) {
  const homes = definition.homes;
  const set = (next: typeof homes) => onChange({ ...definition, homes: next });
  const pages = Object.entries(definition.pages).filter(([, p]) => p.context === 'none');
  const options = [
    ...Object.entries(BUILTIN_PAGES).map(([key, b]) => ({ value: `builtin:${key}`, label: `${b.label} (built-in)` })),
    ...pages.map(([key, p]) => ({ value: key, label: p.title })),
  ];
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="homes-inspector">
      <InspectorSection title="Homes" description="After signing in, each member lands on the first home whose rule they pass; nobody matching: the dashboard.">
        {homes.map((home, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-2.5" data-testid="home-row">
            <div className="flex items-center gap-2">
              <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
              <select aria-label={`Home ${i + 1}`} value={home.page ?? `builtin:${home.builtin ?? 'dashboard'}`} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                onChange={(e) => set(homes.map((h, j) => (j === i ? (e.target.value.startsWith('builtin:') ? { builtin: e.target.value.slice(8) as keyof typeof BUILTIN_PAGES, access: h.access } : { page: e.target.value, access: h.access }) : h)))}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button type="button" aria-label="Remove" className="rounded p-1 text-muted-foreground hover:text-destructive" onClick={() => set(homes.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <AccessRuleEditor compact label={`Who lands on home ${i + 1}`} defaultLabel="Every member" value={home.access} onChange={(access) => set(homes.map((h, j) => (j === i ? { ...h, access } : h)))} />
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => set([...homes, pages[0] ? { page: pages[0][0] } : { builtin: 'tasks' }])} data-testid="add-home"><Plus className="h-4 w-4" />Add a home</Button>
      </InspectorSection>
    </fieldset>
  );
}

// --- access report ---------------------------------------------------------------------------------------------------------

interface RoleReport {
  role: string; name: string; menu: string[]; pages: string[]; actions: string[];
  clientPage: { buttons: string[]; tabs: string[] }; casePage: { buttons: string[]; tabs: string[] }; dashboardWidgets: number; warnings: string[];
}

/** Per role: what its holders get from the draft, and where they would see a widget empty. */
export function AccessReportDialog({ open, onClose, definition }: { open: boolean; onClose: () => void; definition: Definition }) {
  const { axios } = useAxios();
  const [report, setReport] = useState<{ roles: RoleReport[]; heldByNobody: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setReport(null);
    setError(null);
    axios.post(`${API_BASE_URL}/backoffice/current/access-report`, { definition }).then((r) => setReport(r.data)).catch((e) => setError(apiErrorMessage(e)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = (items: string[]) => (items.length ? items.join(', ') : <span className="text-muted-foreground">—</span>);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Who gets what</DialogTitle>
          <DialogDescription>What the holders of each role get from this draft. Conditions on members’ attributes count as met; the actual people are on each role’s page.</DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!report && !error && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {report && (
          <div className="space-y-4" data-testid="access-report">
            {report.heldByNobody.length > 0 && (
              <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
                No role but the administrator holds {report.heldByNobody.map((p) => <span key={p} className="mx-0.5 rounded bg-background px-1 font-mono text-xs">{p}</span>)}: what needs it reaches nobody else yet. Administrators grant it on the Roles page.
              </p>
            )}
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>{['Role', 'Menu', 'Pages', 'Actions', 'Client page', 'Case page', 'Dashboard'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {report.roles.map((r) => (
                    <tr key={r.role} className="border-t align-top" data-testid="access-report-role" data-role={r.role}>
                      <td className="px-3 py-2 font-medium">{r.name}{r.warnings.map((w) => <p key={w} className="mt-1 flex gap-1 text-xs font-normal text-warning"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />{w}</p>)}</td>
                      <td className="px-3 py-2">{list(r.menu)}</td>
                      <td className="px-3 py-2">{list(r.pages)}</td>
                      <td className="px-3 py-2">{list(r.actions)}</td>
                      <td className="px-3 py-2">{list([...r.clientPage.buttons, ...r.clientPage.tabs.map((t) => `${t} tab`)])}</td>
                      <td className="px-3 py-2">{list([...r.casePage.buttons, ...r.casePage.tabs.map((t) => `${t} tab`)])}</td>
                      <td className="px-3 py-2">{r.dashboardWidgets ? `${r.dashboardWidgets} widget${r.dashboardWidgets > 1 ? 's' : ''}` : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- templates -------------------------------------------------------------------------------------------------------------

interface BackOfficeTemplate { id: string; name: string; category: string; description: string }

export function BackOfficeTemplatesDialog<T>({ open, onClose, onInstalled }: { open: boolean; onClose: () => void; onInstalled: (result: T & { installed?: { nextSteps: string[] } }) => void }) {
  const { axios } = useAxios();
  const { data: templates = [] } = useApiQuery<BackOfficeTemplate[]>(['backoffice', 'templates'], open ? '/backoffice/templates' : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[] | null>(null);
  useEffect(() => { if (open) setSteps(null); }, [open]);
  const install = async (id: string) => {
    setBusy(id);
    try {
      const { data } = await axios.post<T & { installed?: { nextSteps: string[] } }>(`${API_BASE_URL}/backoffice/current/template`, { template: id });
      onInstalled(data);
      const next = data.installed?.nextSteps ?? [];
      if (next.length) setSteps(next);
      else { toast.success('Template loaded into the draft'); onClose(); }
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {steps ? (
          <>
            <DialogHeader><DialogTitle>Template loaded — what is left</DialogTitle><DialogDescription>The draft has its pages, actions and additions. Before members see them:</DialogDescription></DialogHeader>
            <ol className="list-decimal space-y-2 pl-5 text-sm" data-testid="template-next-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <DialogFooter><Button onClick={onClose}>Got it</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Start from a template</DialogTitle>
              <DialogDescription>Replaces the draft (published versions stay). A template can also create the permission, attribute and workflow it needs.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col rounded-xl border p-4" data-testid="bo-template" data-template={t.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{t.category}</p>
                  <p className="mt-1 font-semibold">{t.name}</p>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.description}</p>
                  <Button size="sm" className="mt-4 self-start" disabled={!!busy} onClick={() => void install(t.id)}>{busy === t.id && <Loader2 className="h-4 w-4 animate-spin" />}Use this template</Button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const restrictedBadge = (rule: AccessRule | undefined) => (rule ? <Lock className={cn('h-3.5 w-3.5 shrink-0 opacity-50')} aria-label="Only for some members" /> : null);
