import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import jsonata from 'jsonata';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase, Eye, FileStack, FolderKanban, Home, LayoutDashboard, LayoutTemplate, Loader2, Lock, Menu, PanelsTopLeft, Plus, Rocket, ShieldCheck, UserRound, Zap,
} from 'lucide-react';
import {
  BACK_OFFICE_WIDGETS, BLANK_BACK_OFFICE, BUILTIN_PAGES, backOfficeDefinitionSchema, backOfficeWidgetDefinition, ordered, validateBackOffice,
  type BackOfficeDefinition, type BackOfficeWidget,
} from '@repo/fintivio/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { humanize } from '@/components/app/page';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorDetails, apiErrorMessage, useApiQuery } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';
import { AppIcon, ICON_NAMES } from '@/client-app/icons';
import { RuntimeProvider, WidgetFrameProvider, WidgetList, pageScope, type AppRuntime } from '@/client-app/runtime';
import type { ClientWidget } from '@/client-app/types';
import { asAppDefinition } from '@/back-office/runtime';
import { sampleBackOfficeData } from '@/back-office/sample-data';
import type { CatalogEntry } from '../../roles/RoleDialog';
import type { SchemaFormContext } from '../../workflows/components/catalog/SchemaForm';
import { WidgetOutline } from '../Outline';
import { duplicateIn, findWidget, insertIn, journeyKeyFrom, keyFrom, moveIn, newWidget, removeIn, updateIn } from '../studio-model';
import { Hint, ProblemsButton, SaveIndicator, StudioModeSwitch, VersionsMenu } from '../studio-chrome';
import {
  AccessReportDialog, ActionInspector, BackOfficeTemplatesDialog, BackOfficeWidgetInspector, HomesInspector, NavInspector, PageSettings, SlotInspector, restrictedBadge,
} from './panels';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

const checkExpression = (source: string) => {
  try {
    jsonata(source);
    return null;
  } catch (error) {
    return (error as { message?: string }).message ?? 'invalid expression';
  }
};

type Definition = BackOfficeDefinition;

interface StudioBackOffice {
  id: string;
  name: string;
  draft: Definition;
  activeVersion: number | null;
  versions: Array<{ version: number; publishedAt: string; publishedBy: string }>;
  errors: string[];
  workflows: Array<{ id: string; name: string; active: boolean }>;
  roles: Array<{ key: string; name: string }>;
  permissions: CatalogEntry[];
}

/** What the studio is editing. */
type Target =
  | { kind: 'page'; key: string }
  | { kind: 'dashboard' }
  | { kind: 'slot'; scope: 'client' | 'case' }
  | { kind: 'action'; key: string }
  | { kind: 'nav'; index: number }
  | { kind: 'homes' };

type Tab = 'screens' | 'actions' | 'menu';

/** Defaults filled in (JSONB keeps neither defaults nor key order). */
function normalize(raw: unknown): Definition {
  const parsed = backOfficeDefinitionSchema.safeParse(raw);
  const value = parsed.success ? parsed.data : { ...BLANK_BACK_OFFICE, ...(raw as Partial<Definition>) };
  const slots: Partial<Definition['slots']> = value.slots ?? {};
  const part = (scope: 'client' | 'case') => ({ actions: slots[scope]?.actions ?? [], tabs: slots[scope]?.tabs ?? [] });
  return {
    ...value,
    navigation: value.navigation ?? [], homes: value.homes ?? [],
    slots: { dashboard: slots.dashboard ?? [], client: part('client'), case: part('case') },
    pages: Object.fromEntries(ordered(value.pages ?? {}, value.pageOrder)),
    actions: Object.fromEntries(ordered(value.actions ?? {}, value.actionOrder)),
  };
}

const widgetsOf = (definition: Definition, target: Target): BackOfficeWidget[] | null =>
  target.kind === 'page' ? definition.pages[target.key]?.widgets ?? null : target.kind === 'dashboard' ? definition.slots.dashboard : null;

/**
 * The studio's back-office mode (docs/plans/16 §5.9): the institution's own pages for its team, actions that run
 * workflows with staff screens, menu items, buttons and tabs added to the client and case pages, widgets added to the
 * dashboard, homes. Every item says who gets it; the canvas previews the draft as any role; the access report shows
 * what each role gets. Validation, publication, versions.
 */
export default function BackOfficeStudioPage() {
  const { hasPermission, user } = useAuth();
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const canManage = hasPermission('backoffice:manage');
  const canPublish = hasPermission('backoffice:publish');
  const readOnly = !canManage;
  const { data: app, isLoading, error } = useApiQuery<StudioBackOffice>(['backoffice-studio'], '/backoffice/current');

  const [definition, setDefinition] = useState<Definition | null>(null);
  const [tab, setTab] = useState<Tab>('screens');
  const [target, setTarget] = useState<Target>({ kind: 'dashboard' });
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [dialog, setDialog] = useState<null | 'page' | 'action' | 'templates' | 'report'>(null);
  const [publishing, setPublishing] = useState(false);
  const [previewRole, setPreviewRole] = useState<string>('');
  const loaded = useRef(false);

  useEffect(() => {
    if (!app || loaded.current) return;
    loaded.current = true;
    const draft = normalize(app.draft);
    setDefinition(draft);
    const first = Object.keys(draft.pages)[0];
    setTarget(first ? { kind: 'page', key: first } : { kind: 'dashboard' });
  }, [app]);

  // Autosave shortly after each change.
  const edits = useRef(0);
  const change = useCallback((next: Definition) => {
    edits.current++;
    setDefinition(next);
    setSaveState('dirty');
  }, []);
  useEffect(() => {
    if (!definition || saveState !== 'dirty' || readOnly) return;
    const at = edits.current;
    const timer = setTimeout(async () => {
      setSaveState('saving');
      try {
        const { data } = await axios.put<StudioBackOffice>(`${API_BASE_URL}/backoffice/current/draft`, { definition: { ...definition, pageOrder: Object.keys(definition.pages), actionOrder: Object.keys(definition.actions) } });
        queryClient.setQueryData(['backoffice-studio'], { ...data, draft: app?.draft });
        setSaveState(edits.current === at ? 'saved' : 'dirty');
      } catch (e) {
        setSaveState('error');
        toast.error(`The draft could not be saved: ${apiErrorMessage(e)}`);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [definition, saveState, readOnly, axios, queryClient, app?.draft]);

  const workflows = useMemo(() => app?.workflows ?? [], [app?.workflows]);
  const roles = useMemo(() => app?.roles ?? [], [app?.roles]);
  const errors = useMemo(() => (definition ? validateBackOffice(definition, {
    workflows, roles: roles.map((r) => r.key), permissions: (app?.permissions ?? []).filter((p) => !p.archived).map((p) => p.id), checkExpression,
  }) : []), [definition, workflows, roles, app?.permissions]);

  // Preview as a role: the API prunes the draft as it would for a member holding it.
  const [pruned, setPruned] = useState<Definition | null>(null);
  useEffect(() => {
    if (!previewRole || !definition) return setPruned(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      axios.post<{ definition: Definition }>(`${API_BASE_URL}/backoffice/current/preview`, { roles: [previewRole], definition })
        .then((r) => { if (!cancelled) setPruned(normalize(r.data.definition)); })
        .catch((e) => { if (!cancelled) toast.error(apiErrorMessage(e)); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [previewRole, definition, axios]);

  const context = useMemo<SchemaFormContext>(() => {
    if (!definition) return { roles: [] };
    const pages = Object.entries(definition.pages);
    const sources = ['member', 'cases', 'tasks', 'metrics', 'client', 'case', ...new Set(JSON.stringify(definition).match(/records:[a-z][a-z0-9_-]*/g) ?? []), 'records:accounts', 'records:transactions']
      .filter((s, i, all) => all.indexOf(s) === i).map((s) => ({ value: s, label: s }));
    return {
      roles: roles.map((r) => r.key), icons: ICON_NAMES,
      choices: {
        source: sources,
        page: [
          ...pages.filter(([, p]) => p.context === 'none').map(([key, p]) => ({ value: key, label: p.title })),
          ...Object.entries(BUILTIN_PAGES).map(([key, b]) => ({ value: `builtin:${key}`, label: `${b.label} (built-in)` })),
          { value: 'builtin:case', label: 'A case (built-in; params: id)' }, { value: 'builtin:client', label: 'A client (built-in; params: id)' },
        ],
        menuPage: pages.filter(([, p]) => p.context === 'none').map(([key, p]) => ({ value: key, label: p.title })),
        journey: Object.entries(definition.actions).map(([key, a]) => ({ value: key, label: `${a.label}${a.context !== 'none' ? ` (on a ${a.context})` : ''}` })),
        menuAction: Object.entries(definition.actions).filter(([, a]) => a.context === 'none').map(([key, a]) => ({ value: key, label: a.label })),
        workflowPick: workflows.map((w) => ({ value: w.id, label: `${w.name}${w.active ? '' : ' (not published)'}` })),
      },
    };
  }, [definition, workflows, roles]);

  const publish = async () => {
    setPublishing(true);
    try {
      if (saveState !== 'saved' && definition) await axios.put(`${API_BASE_URL}/backoffice/current/draft`, { definition });
      const { data } = await axios.post<StudioBackOffice>(`${API_BASE_URL}/backoffice/current/publish`);
      queryClient.setQueryData(['backoffice-studio'], data);
      await queryClient.invalidateQueries({ queryKey: ['backoffice', 'app'] });
      setSaveState('saved');
      toast.success(`Published version ${data.activeVersion} — your team sees it now`);
    } catch (e) {
      toast.error(apiErrorMessage(e), { description: apiErrorDetails(e).slice(0, 3).join(' · ') || undefined });
    } finally {
      setPublishing(false);
    }
  };
  const activate = async (version: number) => {
    try {
      const { data } = await axios.post<StudioBackOffice>(`${API_BASE_URL}/backoffice/current/activate`, { version });
      queryClient.setQueryData(['backoffice-studio'], data);
      await queryClient.invalidateQueries({ queryKey: ['backoffice', 'app'] });
      toast.success(`Your team now gets version ${version}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const restore = async (version: number) => {
    try {
      const { data } = await axios.get<{ definition: Definition }>(`${API_BASE_URL}/backoffice/current/versions/${version}`);
      change(normalize(data.definition));
      setWidgetId(null);
      toast.success(`Version ${version} loaded into the draft`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  if (error) return <div className="p-8 text-sm text-destructive">{apiErrorMessage(error)}</div>;
  if (isLoading || !app || !definition) {
    return <div className="flex h-full gap-4 p-4"><Skeleton className="h-full w-72" /><Skeleton className="h-full flex-1" /><Skeleton className="h-full w-80" /></div>;
  }

  const widgets = widgetsOf(definition, target);
  const widget = widgets ? findWidget({ title: '', widgets } as never, widgetId) as BackOfficeWidget | null : null;
  const editWidgets = (edit: (list: ClientWidget[]) => void) => {
    const next = structuredClone(definition);
    const list = widgetsOf(next, target);
    if (!list) return;
    edit(list as ClientWidget[]);
    change(next);
  };
  const select = (next: Target) => {
    setTarget(next);
    setWidgetId(null);
  };
  const addWidget = (type: string) => {
    const created = newWidget(type, backOfficeWidgetDefinition);
    editWidgets((list) => insertIn(list, created, widgetId));
    setWidgetId(created.id);
  };

  const TABS: Array<{ key: Tab; label: string; icon: typeof FileStack }> = [
    { key: 'screens', label: 'Screens', icon: FileStack }, { key: 'actions', label: 'Actions', icon: Zap }, { key: 'menu', label: 'Menu', icon: Menu },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="bo-studio">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <StudioModeSwitch fallback={<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><PanelsTopLeft className="h-4 w-4" /></span>} />
        <Input
          aria-label="Back office name" value={definition.name} disabled={readOnly} onChange={(e) => change({ ...definition, name: e.target.value })}
          className="h-8 w-40 border-transparent bg-transparent px-2 text-[15px] font-semibold shadow-none hover:border-input focus-visible:border-input"
        />
        <SaveIndicator state={saveState} readOnly={readOnly} />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <ProblemsButton errors={errors} />
          {canManage && <Button size="sm" variant="ghost" onClick={() => setDialog('templates')} data-testid="open-templates"><LayoutTemplate className="h-4 w-4" />Templates</Button>}
          <Button size="sm" variant="ghost" onClick={() => setDialog('report')} data-testid="open-access-report"><ShieldCheck className="h-4 w-4" />Who gets what</Button>
          <VersionsMenu app={app} canPublish={canPublish} canManage={canManage} onActivate={activate} onRestore={restore} />
          {canPublish && (
            <Button size="sm" onClick={() => void publish()} disabled={publishing || errors.length > 0} data-testid="publish-back-office" title={errors.length ? 'Fix the problems first' : undefined}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Publish
            </Button>
          )}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left: structure */}
        <aside className="flex w-[272px] shrink-0 flex-col border-r bg-muted/20">
          <div className="grid grid-cols-3 gap-1 border-b p-2" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-testid={`bo-tab-${t.key}`}
                onClick={() => {
                  setTab(t.key);
                  if (t.key === 'actions') { const first = Object.keys(definition.actions)[0]; if (first) select({ kind: 'action', key: first }); }
                  if (t.key === 'menu') select(definition.navigation.length ? { kind: 'nav', index: 0 } : { kind: 'homes' });
                  if (t.key === 'screens') { const first = Object.keys(definition.pages)[0]; select(first ? { kind: 'page', key: first } : { kind: 'dashboard' }); }
                }}
                className={cn('flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors', tab === t.key ? 'bg-background text-primary shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
                <t.icon className="h-4 w-4" />{t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
            {tab === 'screens' && (
              <>
                <ListBlock title="Your pages" onAdd={readOnly ? undefined : () => setDialog('page')} addLabel="Page" addTestId="add-page">
                  {Object.entries(definition.pages).map(([key, page]) => (
                    <ListItem key={key} active={target.kind === 'page' && target.key === key} onClick={() => select({ kind: 'page', key })} icon={page.icon} fallback="file" testId="bo-page" data={key}
                      label={page.title} hint={page.context === 'none' ? (definition.navigation.some((n) => n.page === key) ? 'in the menu' : 'linked') : `tab of the ${page.context} page`} locked={!!page.access} />
                  ))}
                  {!Object.keys(definition.pages).length && <Empty>No page yet. Pages are made of widgets: figures, lists, tables of cases, tasks and clients’ records.</Empty>}
                </ListBlock>
                <ListBlock title="Added to built-in pages">
                  <ListItem active={target.kind === 'dashboard'} onClick={() => select({ kind: 'dashboard' })} iconNode={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" hint={`${definition.slots.dashboard.length} widget${definition.slots.dashboard.length === 1 ? '' : 's'}`} testId="bo-slot" data="dashboard" />
                  <ListItem active={target.kind === 'slot' && target.scope === 'client'} onClick={() => select({ kind: 'slot', scope: 'client' })} iconNode={<UserRound className="h-4 w-4" />} label="Client page" hint={slotHint(definition, 'client')} testId="bo-slot" data="client" />
                  <ListItem active={target.kind === 'slot' && target.scope === 'case'} onClick={() => select({ kind: 'slot', scope: 'case' })} iconNode={<FolderKanban className="h-4 w-4" />} label="Case page" hint={slotHint(definition, 'case')} testId="bo-slot" data="case" />
                  <p className="px-1 pt-1 text-[11.5px] leading-relaxed text-muted-foreground">Built-in pages are never replaced: you add buttons, tabs and widgets to them.</p>
                </ListBlock>
                {widgets && (
                  <WidgetOutline
                    title={target.kind === 'dashboard' ? 'Widgets added to the dashboard' : 'Widgets on this page'}
                    widgets={widgets} selected={widgetId} onSelect={setWidgetId} readOnly={readOnly} onAdd={addWidget} palette={BACK_OFFICE_WIDGETS}
                    onMove={(id, direction) => editWidgets((list) => moveIn(list, id, direction))}
                    onDuplicate={(id) => { let copy: string | null = null; editWidgets((list) => { copy = duplicateIn(list, id); }); setWidgetId(copy); }}
                    onRemove={(id) => { editWidgets((list) => removeIn(list, id)); if (widgetId === id) setWidgetId(null); }}
                  />
                )}
              </>
            )}
            {tab === 'actions' && (
              <ListBlock title="Actions" onAdd={readOnly ? undefined : () => setDialog('action')} addLabel="Action" addTestId="add-action">
                {Object.entries(definition.actions).map(([key, action]) => {
                  const workflow = workflows.find((w) => w.id === action.workflowId);
                  return (
                    <ListItem key={key} active={target.kind === 'action' && target.key === key} onClick={() => select({ kind: 'action', key })} icon={action.icon} fallback="zap" testId="bo-action" data={key}
                      label={action.label} hint={`${workflow ? workflow.name : 'workflow missing'}${action.context !== 'none' ? ` · on a ${action.context}` : ''}`} warn={!workflow?.active} locked={!!action.access} />
                  );
                })}
                {!Object.keys(definition.actions).length && <Empty>An action starts a workflow from a button or the menu — with the client or case of the page. Its team.screen steps open over the page.</Empty>}
              </ListBlock>
            )}
            {tab === 'menu' && (
              <>
                <ListBlock title="Menu items" onAdd={readOnly ? undefined : () => {
                  const page = Object.entries(definition.pages).find(([, p]) => p.context === 'none');
                  const action = Object.entries(definition.actions).find(([, a]) => a.context === 'none');
                  if (!page && !action) return toast.error('Add a page (about nothing in particular) or an action that needs no client first');
                  change({ ...definition, navigation: [...definition.navigation, page ? { section: 'Work', label: page[1].title, icon: page[1].icon, page: page[0] } : { section: 'Work', label: action![1].label, icon: action![1].icon, action: action![0] }] });
                  select({ kind: 'nav', index: definition.navigation.length });
                }} addLabel="Item" addTestId="add-nav">
                  {definition.navigation.map((item, index) => (
                    <ListItem key={`${item.label}-${index}`} active={target.kind === 'nav' && target.index === index} onClick={() => select({ kind: 'nav', index })} icon={item.icon} fallback={item.action ? 'zap' : 'layout-grid'} testId="bo-nav" data={String(index)}
                      label={item.label} hint={`${item.section} · ${item.page ? definition.pages[item.page]?.title ?? item.page : definition.actions[item.action ?? '']?.label ?? item.action}`} locked={!!item.access} />
                  ))}
                  {!definition.navigation.length && <Empty>Your menu items go into the sections of the menu (Work, Administration…) or into sections of their own.</Empty>}
                </ListBlock>
                <ListBlock title="After signing in">
                  <ListItem active={target.kind === 'homes'} onClick={() => select({ kind: 'homes' })} iconNode={<Home className="h-4 w-4" />} label="Homes" hint={definition.homes.length ? `${definition.homes.length} rule${definition.homes.length > 1 ? 's' : ''}` : 'the dashboard for everyone'} testId="bo-homes" />
                </ListBlock>
              </>
            )}
          </div>
        </aside>

        {/* Center: the draft as it renders (as a role, when chosen) */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
            <p className="min-w-0 truncate text-sm text-muted-foreground">{targetTitle(definition, target)}</p>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-muted-foreground" /><span className="whitespace-nowrap text-muted-foreground">Preview as</span>
              <select aria-label="Preview as" data-testid="bo-preview-as" value={previewRole} onChange={(e) => setPreviewRole(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                <option value="">Designer (everything)</option>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
              </select>
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] p-6 [background-size:16px_16px]" data-testid="bo-canvas">
            <CanvasBody
              definition={definition} shown={previewRole ? pruned : definition} previewing={!!previewRole} roleName={roles.find((r) => r.key === previewRole)?.name ?? ''}
              target={target} workflows={workflows} selected={widgetId} member={{ email: user?.email ?? 'me@example.com', name: (user as { name?: string } | null)?.name ?? null }}
              onSelectWidget={(id) => { setTab('screens'); setWidgetId(id); }}
              onOpenPage={(key) => { if (definition.pages[key]) { setTab('screens'); select({ kind: 'page', key }); } }}
              onSelectTarget={(next) => { setTab(next.kind === 'action' ? 'actions' : next.kind === 'nav' || next.kind === 'homes' ? 'menu' : 'screens'); select(next); }}
            />
          </div>
        </div>

        {/* Right: inspector */}
        <aside className="w-[340px] shrink-0 overflow-y-auto border-l" data-testid="studio-inspector">
          {widget && (
            <BackOfficeWidgetInspector
              key={widget.id} widget={widget} context={context} readOnly={readOnly}
              onChange={(next) => editWidgets((list) => updateIn(list, widget.id, () => next as ClientWidget))}
              onRemove={() => { editWidgets((list) => removeIn(list, widget.id)); setWidgetId(null); }}
            />
          )}
          {!widget && target.kind === 'page' && (
            <PageSettings key={target.key} definition={definition} pageKey={target.key} context={context} onChange={change} readOnly={readOnly}
              onDelete={() => {
                const { [target.key]: _removed, ...pages } = definition.pages;
                change({
                  ...definition, pages,
                  navigation: definition.navigation.filter((n) => n.page !== target.key), homes: definition.homes.filter((h) => h.page !== target.key),
                  slots: { ...definition.slots, client: { ...definition.slots.client, tabs: definition.slots.client.tabs.filter((t) => t.page !== target.key) }, case: { ...definition.slots.case, tabs: definition.slots.case.tabs.filter((t) => t.page !== target.key) } },
                });
                select({ kind: 'dashboard' });
              }} />
          )}
          {!widget && target.kind === 'dashboard' && <Hint icon={LayoutDashboard} title="The dashboard" text="Widgets you add here appear on every member's dashboard, under its own figures — each widget only for the members its rule lets in. Select a widget to edit it." />}
          {target.kind === 'slot' && <SlotInspector key={target.scope} definition={definition} scope={target.scope} onChange={change} readOnly={readOnly} />}
          {target.kind === 'action' && (
            <ActionInspector key={target.key} definition={definition} actionKey={target.key} context={context} workflows={workflows} onChange={change} readOnly={readOnly}
              onDelete={() => {
                const { [target.key]: _removed, ...actions } = definition.actions;
                change({
                  ...definition, actions,
                  navigation: definition.navigation.filter((n) => n.action !== target.key),
                  slots: { ...definition.slots, client: { ...definition.slots.client, actions: definition.slots.client.actions.filter((a) => a.action !== target.key) }, case: { ...definition.slots.case, actions: definition.slots.case.actions.filter((a) => a.action !== target.key) } },
                });
                setTarget({ kind: 'dashboard' });
                setTab('screens');
              }} />
          )}
          {target.kind === 'nav' && <NavInspector key={target.index} definition={definition} index={target.index} context={context} onChange={change} readOnly={readOnly} />}
          {target.kind === 'homes' && <HomesInspector definition={definition} onChange={change} readOnly={readOnly} />}
        </aside>
      </div>

      <NewItemDialog
        open={dialog === 'page'} title="New page" onClose={() => setDialog(null)} contextLabel="The page is"
        onSubmit={(title, pageContext) => {
          const key = keyFrom(title, Object.keys(definition.pages));
          const next: Definition = { ...definition, pages: { ...definition.pages, [key]: { title, context: pageContext, widgets: [] } } };
          if (pageContext === 'none') next.navigation = [...definition.navigation, { section: 'Work', label: title, page: key }];
          else next.slots = { ...definition.slots, [pageContext]: { ...definition.slots[pageContext], tabs: [...definition.slots[pageContext].tabs, { page: key, label: title }] } };
          change(next);
          setTab('screens');
          select({ kind: 'page', key });
        }}
      />
      <NewItemDialog
        open={dialog === 'action'} title="New action" onClose={() => setDialog(null)} contextLabel="It runs" workflows={workflows}
        onSubmit={(label, actionContext, workflowId) => {
          const key = journeyKeyFrom(label, Object.keys(definition.actions));
          change({ ...definition, actions: { ...definition.actions, [key]: { label, workflowId: workflowId ?? '', context: actionContext, input: {}, inputs: [], presentation: { mode: 'dialog' } } } });
          setTab('actions');
          select({ kind: 'action', key });
        }}
      />
      <BackOfficeTemplatesDialog<StudioBackOffice>
        open={dialog === 'templates'} onClose={() => setDialog(null)}
        onInstalled={(next) => {
          queryClient.setQueryData(['backoffice-studio'], next);
          const draft = normalize(next.draft);
          setDefinition(draft);
          setSaveState('saved');
          const first = Object.keys(draft.pages)[0];
          select(first ? { kind: 'page', key: first } : { kind: 'dashboard' });
          setTab('screens');
        }}
      />
      <AccessReportDialog open={dialog === 'report'} onClose={() => setDialog(null)} definition={definition} />
    </div>
  );
}

const slotHint = (definition: Definition, scope: 'client' | 'case') => {
  const { actions, tabs } = definition.slots[scope];
  const parts = [actions.length && `${actions.length} button${actions.length > 1 ? 's' : ''}`, tabs.length && `${tabs.length} tab${tabs.length > 1 ? 's' : ''}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'nothing added';
};

function targetTitle(definition: Definition, target: Target) {
  switch (target.kind) {
    case 'page': {
      const page = definition.pages[target.key];
      return page ? (page.context === 'none' ? `Page · ${page.title}` : `${humanize(page.context)} page · tab “${page.title}”`) : '';
    }
    case 'dashboard': return 'Dashboard · your additions';
    case 'slot': return `${humanize(target.scope)} page · your additions`;
    case 'action': return `Action · ${definition.actions[target.key]?.label ?? ''}`;
    case 'nav': return 'Menu';
    case 'homes': return 'Homes';
  }
}

function ListBlock({ title, onAdd, addLabel, addTestId, children }: { title: string; onAdd?: () => void; addLabel?: string; addTestId?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        {onAdd && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd} data-testid={addTestId}><Plus className="h-3.5 w-3.5" />{addLabel}</Button>}
      </div>
      {children}
    </div>
  );
}

function ListItem({ active, onClick, icon, iconNode, fallback, label, hint, locked, warn, testId, data }: {
  active: boolean; onClick: () => void; icon?: string; iconNode?: ReactNode; fallback?: string; label: string; hint?: string; locked?: boolean; warn?: boolean; testId?: string; data?: string;
}) {
  return (
    <button type="button" onClick={onClick} data-testid={testId} data-key={data}
      className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors', active ? 'bg-primary-soft' : 'hover:bg-muted')}>
      <span className={cn('mt-0.5 shrink-0', active ? 'text-primary' : 'opacity-70')}>{iconNode ?? <AppIcon name={icon} fallback={fallback} className="h-4 w-4" />}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', active && 'font-medium text-primary')}>{label}</span>
        {hint && <span className={cn('block truncate text-[11.5px]', warn ? 'text-destructive' : 'text-muted-foreground')}>{hint}</span>}
      </span>
      {locked && <Lock className="mt-1 h-3.5 w-3.5 shrink-0 opacity-50" aria-label="Only for some members" />}
    </button>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-lg border border-dashed p-4 text-center text-xs leading-relaxed text-muted-foreground">{children}</p>;

// --- canvas ------------------------------------------------------------------------------------------------------------------

/**
 * What the selected item looks like: a page (in the built-in client or case page when it is about one), the dashboard's
 * additions, the buttons and tabs of a built-in page, the menu. As a role: the draft as the API prunes it for them.
 */
function CanvasBody({ definition, shown, previewing, roleName, target, workflows, selected, member, onSelectWidget, onOpenPage, onSelectTarget }: {
  definition: Definition; shown: Definition | null; previewing: boolean; roleName: string; target: Target; workflows: Array<{ id: string; name: string }>;
  selected: string | null; member: { email: string; name: string | null };
  onSelectWidget: (id: string) => void; onOpenPage: (key: string) => void; onSelectTarget: (target: Target) => void;
}) {
  if (!shown) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />;
  const banner = previewing && <p className="mx-auto mb-3 max-w-5xl rounded-lg bg-info-soft px-3 py-1.5 text-xs text-info" data-testid="bo-preview-banner">As {roleName}: only what members holding this role get (conditions on attributes are not applied).</p>;
  const frame = (children: ReactNode) => <div className="mx-auto max-w-5xl rounded-2xl border bg-background p-6 shadow-card">{children}</div>;

  if (target.kind === 'page') {
    const page = shown.pages[target.key];
    if (!page) return <>{banner}{frame(<Missing what="this page" />)}</>;
    const body = <Widgets definition={shown} widgets={page.widgets} workflows={workflows} selected={selected} member={member} onSelect={onSelectWidget} onOpenPage={onOpenPage} />;
    if (page.context === 'none') {
      return <>{banner}{frame(<><h2 className="text-2xl font-semibold tracking-tight">{page.title}</h2>{page.description && <p className="mt-1 text-sm text-muted-foreground">{page.description}</p>}<div className="mt-6">{body}</div></>)}</>;
    }
    return <>{banner}{frame(<BuiltinPage definition={shown} scope={page.context} activeTab={target.key} onSelectTarget={onSelectTarget}>{body}</BuiltinPage>)}</>;
  }
  if (target.kind === 'dashboard') {
    return (
      <>
        {banner}
        {frame(
          <>
            <Placeholder label="The dashboard's own greeting and figures" />
            <div className="mt-6">{shown.slots.dashboard.length
              ? <Widgets definition={shown} widgets={shown.slots.dashboard} workflows={workflows} selected={selected} member={member} onSelect={onSelectWidget} onOpenPage={onOpenPage} />
              : <Missing what={previewing ? 'any dashboard widget' : 'nothing yet: add widgets on the left'} plain={!previewing} />}</div>
            <Placeholder label="The dashboard's own lists" className="mt-6" />
          </>,
        )}
      </>
    );
  }
  if (target.kind === 'slot') return <>{banner}{frame(<BuiltinPage definition={shown} scope={target.scope} activeTab={null} onSelectTarget={onSelectTarget}><Placeholder label={`The ${target.scope} page's own content`} tall /></BuiltinPage>)}</>;
  if (target.kind === 'action') {
    const action = shown.actions[target.key];
    const original = definition.actions[target.key];
    return (
      <>
        {banner}
        {frame(action ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-lg font-semibold"><AppIcon name={action.icon} fallback="zap" className="h-5 w-5 text-primary" />{action.label}</p>
            {action.description && <p className="text-muted-foreground">{action.description}</p>}
            <p>Starts <span className="font-medium">{workflows.find((w) => w.id === action.workflowId)?.name ?? 'a missing workflow'}</span>{action.context !== 'none' && <> with the {action.context} of the page</>}; its staff screens open in a {action.presentation?.mode ?? 'dialog'}.</p>
            <p className="text-muted-foreground">Members need the action’s rule and the workflow’s own start rule; the API checks both when they press it.</p>
          </div>
        ) : <Missing what={original ? `“${original.label}” (its rule or the workflow's start rule excludes them)` : 'this action'} />)}
      </>
    );
  }
  // Menu and homes: the menu as the members get it.
  return <>{banner}<MenuPreview definition={shown} onSelect={onSelectTarget} /></>;
}

function Missing({ what, plain }: { what: string; plain?: boolean }) {
  return <p className="py-10 text-center text-sm text-muted-foreground" data-testid="bo-preview-missing">{plain ? `Nothing yet: ${what.replace(/^nothing yet: /, '')}` : `Members with this role do not get ${what}.`}</p>;
}

function Placeholder({ label, className, tall }: { label: string; className?: string; tall?: boolean }) {
  return <div className={cn('flex items-center justify-center rounded-xl border border-dashed bg-muted/30 text-xs text-muted-foreground', tall ? 'h-40' : 'h-20', className)}>{label}</div>;
}

/** The built-in client or case page, with the buttons and tabs the back office adds to it. */
function BuiltinPage({ definition, scope, activeTab, onSelectTarget, children }: { definition: Definition; scope: 'client' | 'case'; activeTab: string | null; onSelectTarget: (target: Target) => void; children: ReactNode }) {
  const slot = definition.slots[scope];
  return (
    <div data-testid="bo-builtin-page" data-scope={scope}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">{scope === 'client' ? <UserRound className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}</span>
          <div><p className="text-xl font-semibold">{scope === 'client' ? 'Chris Client' : 'C-2026-SAMP1'}</p><p className="text-xs text-muted-foreground">{scope === 'client' ? 'chris@example.com · sample client' : 'sample case'}</p></div>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="bo-slot-buttons">
          {slot.actions.map((ref) => {
            const action = definition.actions[ref.action];
            return action ? <Button key={ref.action} size="sm" variant="outline" onClick={() => onSelectTarget({ kind: 'slot', scope })}><AppIcon name={action.icon} fallback="zap" className="h-4 w-4" />{action.label}{ref.access && restrictedBadge(ref.access)}</Button> : null;
          })}
          <Button size="sm" variant="outline" disabled>{scope === 'client' ? 'Edit' : 'Export evidence'}</Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm" data-testid="bo-slot-tabs">
        <span className={cn('rounded-md px-3 py-1', !activeTab ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground')}>Overview</span>
        {slot.tabs.map((t) => (
          <button key={t.page} type="button" onClick={() => onSelectTarget({ kind: 'page', key: t.page })} className={cn('rounded-md px-3 py-1', activeTab === t.page ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground')}>{t.label}</button>
        ))}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function MenuPreview({ definition, onSelect }: { definition: Definition; onSelect: (target: Target) => void }) {
  const sections = definition.navigation.reduce<Record<string, Array<{ item: Definition['navigation'][number]; index: number }>>>((acc, item, index) => ((acc[item.section] ??= []).push({ item, index }), acc), {});
  const builtin = ['Dashboard', 'Tasks', 'Cases', 'Clients'];
  return (
    <div className="mx-auto flex max-w-3xl gap-6" data-testid="bo-menu-preview">
      <div className="w-64 shrink-0 rounded-2xl border bg-sidebar p-3 shadow-card">
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Work</p>
        {builtin.map((b) => <p key={b} className="rounded-md px-2 py-1.5 text-sm text-muted-foreground/70">{b}</p>)}
        {sections.Work?.map(({ item, index }) => <MenuItem key={index} item={item} onClick={() => onSelect({ kind: 'nav', index })} />)}
        {Object.entries(sections).filter(([s]) => s !== 'Work').map(([section, items]) => (
          <div key={section} className="mt-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{section}</p>
            {items.map(({ item, index }) => <MenuItem key={index} item={item} onClick={() => onSelect({ kind: 'nav', index })} />)}
          </div>
        ))}
        <p className="mt-3 px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Administration</p>
        <p className="rounded-md px-2 py-1.5 text-sm text-muted-foreground/70">Settings</p>
      </div>
      <div className="flex-1 space-y-2 pt-2 text-sm text-muted-foreground">
        <p>Grey items are the built-in menu (each shown by its own permissions). Yours come in their section; a new section goes after Work.</p>
        <p>{definition.homes.length ? `After signing in: ${definition.homes.map((h) => (h.page ? definition.pages[h.page]?.title ?? h.page : BUILTIN_PAGES[h.builtin ?? 'dashboard'].label)).join(', then ')} — the first whose rule passes.` : 'After signing in: the dashboard.'}</p>
      </div>
    </div>
  );
}

function MenuItem({ item, onClick }: { item: Definition['navigation'][number]; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted" data-testid="bo-menu-item">
      <AppIcon name={item.icon} fallback={item.action ? 'zap' : 'layout-grid'} className="h-4 w-4 opacity-80" /><span className="flex-1 truncate">{item.label}</span>{restrictedBadge(item.access)}
    </button>
  );
}

/** Widgets drawn by the back office's renderer with sample data; clicking one selects it. */
function Widgets({ definition, widgets, workflows, selected, member, onSelect, onOpenPage }: {
  definition: Definition; widgets: BackOfficeWidget[]; workflows: Array<{ id: string; name: string }>; selected: string | null; member: { email: string; name: string | null };
  onSelect: (id: string) => void; onOpenPage: (key: string) => void;
}) {
  const { tenant } = useAuth();
  const data = useMemo(() => sampleBackOfficeData(definition, workflows, widgets, member), [definition, workflows, widgets, member]);
  const scope = useMemo(() => pageScope(data, {}), [data]);
  const runtime = useMemo<AppRuntime>(() => ({
    definition: asAppDefinition(definition), institution: { name: tenant?.name ?? '', pallette: tenant?.pallette ?? null }, mode: 'preview',
    openPage: (page) => onOpenPage(page), startJourney: async () => { toast.info('Actions run in the published back office'); }, openCase: () => undefined, starting: null,
  }), [definition, tenant, onOpenPage]);
  const frame = useCallback((widget: ClientWidget, _path: string, element: ReactNode) => (
    <div
      data-select-id={widget.id} onClickCapture={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(widget.id); }}
      className={cn('group/select relative cursor-pointer rounded-2xl outline-offset-4', selected === widget.id ? 'outline outline-2 outline-primary' : 'outline outline-2 outline-transparent hover:outline-primary/40')}
    >
      {element}
      {(widget as BackOfficeWidget).access && <span className="pointer-events-none absolute -top-2.5 right-3 z-10 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground shadow"><Lock className="h-3 w-3" />some members</span>}
    </div>
  ), [selected, onSelect]);
  if (!widgets.length) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No widget yet: add one on the left.</p>;
  return (
    <RuntimeProvider runtime={runtime}>
      <WidgetFrameProvider value={frame}>
        <WidgetList widgets={widgets as ClientWidget[]} scope={scope} />
      </WidgetFrameProvider>
    </RuntimeProvider>
  );
}

// --- dialogs -------------------------------------------------------------------------------------------------------------

function NewItemDialog({ open, title, contextLabel, onClose, onSubmit, workflows }: {
  open: boolean; title: string; contextLabel: string; onClose: () => void;
  onSubmit: (name: string, context: 'none' | 'client' | 'case', workflowId?: string) => void; workflows?: Array<{ id: string; name: string; active: boolean }>;
}) {
  const [value, setValue] = useState('');
  const [scope, setScope] = useState<'none' | 'client' | 'case'>('none');
  const [workflowId, setWorkflowId] = useState('');
  useEffect(() => { if (open) { setValue(''); setScope('none'); setWorkflowId(''); } }, [open]);
  const ready = value.trim() && (!workflows || workflowId);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{workflows ? 'An action starts a workflow; its staff screens open over the page.' : 'A page of widgets for your team: on its own (in the menu) or about one client or case (a tab of their page).'}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!ready) return; onSubmit(value.trim(), scope, workflowId || undefined); onClose(); }} data-testid="bo-new-item">
          <div className="space-y-1.5"><Label htmlFor="bo-new-name">{workflows ? 'Label (e.g. Waive a fee)' : 'Title (e.g. Servicing desk)'}</Label><Input id="bo-new-name" autoFocus value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="bo-new-context">{contextLabel}</Label>
            <select id="bo-new-context" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="none">{workflows ? 'On its own (menu, pages, dashboard)' : 'On its own (in the menu)'}</option>
              <option value="client">{workflows ? 'On a client (client page)' : 'About one client (client page tab)'}</option>
              <option value="case">{workflows ? 'On a case (case page)' : 'About one case (case page tab)'}</option>
            </select>
          </div>
          {workflows && (
            <div className="space-y-1.5">
              <Label htmlFor="bo-new-workflow">Workflow</Label>
              <select id="bo-new-workflow" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose a workflow…</option>
                {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}{w.active ? '' : ' (not published)'}</option>)}
              </select>
            </div>
          )}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!ready}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
