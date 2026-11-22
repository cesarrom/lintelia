import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import jsonata from 'jsonata';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AppWindow, Database, ExternalLink, FileStack, LayoutTemplate, Loader2, Rocket, Route, Settings2,
} from 'lucide-react';
import { appSources, ordered, validateClientApp, type ClientWidget } from '@repo/lintelia/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorDetails, apiErrorMessage, useApiQuery } from '@/lib/services/api';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';
import { ICON_NAMES } from '@/client-app/icons';
import { sampleData } from '@/client-app/sample-data';
import type { AppData, AppDefinition } from '@/client-app/types';
import type { SchemaFormContext } from '../workflows/components/catalog/SchemaForm';
import { Canvas, DeviceToggle, PreviewAs, type Device } from './Canvas';
import { Hint, ProblemsButton, SaveIndicator, StudioModeSwitch, VersionsMenu } from './studio-chrome';
import { PageInspector, WidgetInspector } from './Inspector';
import { PagesList, WidgetOutline } from './Outline';
import { CollectionInspector, CollectionsList, JourneyInspector, JourneysList, SettingsInspector, SettingsList } from './panels';
import {
  duplicateWidget, findWidget, insertWidget, journeyKeyFrom, keyFrom, moveWidget, newWidget, pageLabel, removeWidget, renamePageKey, updateWidget, type Definition,
} from './studio-model';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

/** JSONata syntax check of the app's expressions (the API runs the same check at publication). */
const checkExpression = (source: string) => {
  try {
    jsonata(source);
    return null;
  } catch (error) {
    return (error as { message?: string }).message ?? 'invalid expression';
  }
};

interface StudioApp {
  id: string;
  name: string;
  draft: Definition;
  activeVersion: number | null;
  versions: Array<{ version: number; publishedAt: string; publishedBy: string }>;
  updatedAt: string;
  updatedBy: string | null;
  errors: string[];
  workflows: Array<{ id: string; name: string; active: boolean }>;
  portalUrl: string;
}

type Tab = 'pages' | 'journeys' | 'data' | 'settings';

/** JSONB does not keep key order: pages and journeys back in the authored order. */
function normalize(definition: Definition): Definition {
  return {
    ...definition,
    pages: Object.fromEntries(ordered(definition.pages ?? {}, definition.pageOrder)),
    journeys: Object.fromEntries(ordered(definition.journeys ?? {}, definition.journeyOrder)),
  };
}

/**
 * Client app studio (docs/plans/11 §9): the pages of the institution's app made of widgets, the journeys clients start
 * (workflows), the data collections screens read, sign-up, identity and embedding; a live preview with sample data or
 * as a real client; validation, publication and versions.
 */
export default function StudioPage() {
  const { hasPermission, tenant } = useAuth();
  const { axios } = useAxios();
  const queryClient = useQueryClient();
  const canManage = hasPermission('experience:manage');
  const canPublish = hasPermission('experience:publish');
  const readOnly = !canManage;
  const { data: app, isLoading, error } = useApiQuery<StudioApp>(['client-app-studio'], '/client-apps/current');

  const [definition, setDefinition] = useState<Definition | null>(null);
  const [tab, setTab] = useState<Tab>('pages');
  const [pageKey, setPageKey] = useState<string>('home');
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const [journeyKey, setJourneyKey] = useState<string | null>(null);
  const [collection, setCollection] = useState<number | null>(null);
  const [setting, setSetting] = useState('theme');
  const [device, setDevice] = useState<Device>('desktop');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [previewClient, setPreviewClient] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [dialog, setDialog] = useState<null | 'page' | 'journey' | 'collection' | 'templates'>(null);
  const [publishing, setPublishing] = useState(false);
  const loaded = useRef(false);

  // First load: the draft becomes the working copy. Links from the map open a page, a journey or the settings.
  const [search] = useSearchParams();
  useEffect(() => {
    if (!app || loaded.current) return;
    loaded.current = true;
    const draft = normalize(app.draft);
    setDefinition(draft);
    const wanted = search.get('page');
    setPageKey(wanted && wanted in draft.pages ? wanted : draft.home in draft.pages ? draft.home : Object.keys(draft.pages)[0] ?? 'home');
    const journey = search.get('journey');
    if (journey && draft.journeys?.[journey]) {
      setTab('journeys');
      setJourneyKey(journey);
    } else if (search.get('tab') === 'settings') setTab('settings');
  }, [app]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave the draft shortly after each change.
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
        const { data } = await axios.put<StudioApp>(`${API_BASE_URL}/client-apps/current/draft`, { definition });
        queryClient.setQueryData(['client-app-studio'], { ...data, draft: app?.draft });
        setSaveState(edits.current === at ? 'saved' : 'dirty');
      } catch (e) {
        setSaveState('error');
        toast.error(`The draft could not be saved: ${apiErrorMessage(e)}`);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [definition, saveState, readOnly, axios, queryClient, app?.draft]);

  const workflows = app?.workflows ?? [];
  const errors = useMemo(() => (definition ? validateClientApp(definition, { workflows, checkExpression }) : []), [definition, workflows]);

  // Preview data: generated sample, or a real client's data (the studio asks the API as that client would read it).
  const [data, setData] = useState<AppData | null>(null);
  const definitionKey = useMemo(() => JSON.stringify(definition ? { c: definition.collections, p: definition.profile, j: definition.journeys, r: definition.registration } : null), [definition]);
  useEffect(() => {
    if (!definition) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = previewClient
          ? (await axios.post<AppData>(`${API_BASE_URL}/client-apps/current/preview`, { clientId: previewClient.id, sources: appSources(definition), definition })).data
          : await sampleData(definition as AppDefinition);
        if (!cancelled) setData(next);
      } catch (e) {
        if (!cancelled) toast.error(apiErrorMessage(e));
      }
    })();
    return () => { cancelled = true; };
  }, [definitionKey, previewClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const context = useMemo<SchemaFormContext>(() => {
    if (!definition) return { roles: [] };
    const pages = ordered(definition.pages, definition.pageOrder).map(([key]) => ({ value: key, label: pageLabel(definition, key) }));
    const journeys = ordered(definition.journeys, definition.journeyOrder).map(([key, j]) => ({ value: key, label: j.title }));
    const sources = appSources(definition).map((s) => ({ value: s, label: s.startsWith('records:') ? `${definition.collections.find((c) => `records:${c.key}` === s)?.label ?? s} (${s})` : s }));
    return {
      roles: [], icons: ICON_NAMES,
      choices: {
        page: pages, journey: journeys, source: sources,
        workflowPick: workflows.map((w) => ({ value: w.id, label: `${w.name}${w.active ? '' : ' (not published)'}` })),
      },
    };
  }, [definition, workflows]);

  const publish = async () => {
    setPublishing(true);
    try {
      if (saveState !== 'saved') await axios.put(`${API_BASE_URL}/client-apps/current/draft`, { definition });
      const { data } = await axios.post<StudioApp>(`${API_BASE_URL}/client-apps/current/publish`);
      queryClient.setQueryData(['client-app-studio'], data);
      setSaveState('saved');
      toast.success(`Published version ${data.activeVersion} — clients see it now`);
    } catch (e) {
      const details = apiErrorDetails(e);
      toast.error(apiErrorMessage(e), { description: details.slice(0, 3).join(' · ') || undefined });
    } finally {
      setPublishing(false);
    }
  };

  const activate = async (version: number) => {
    try {
      const { data } = await axios.post<StudioApp>(`${API_BASE_URL}/client-apps/current/activate`, { version });
      queryClient.setQueryData(['client-app-studio'], data);
      toast.success(`Clients now get version ${version}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const restore = async (version: number) => {
    try {
      const { data } = await axios.get<{ definition: Definition }>(`${API_BASE_URL}/client-apps/current/versions/${version}`);
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

  const page = definition.pages[pageKey];
  const widget = findWidget(page, widgetId);
  const institution = { name: tenant?.name ?? app.name, pallette: tenant?.pallette ?? null, logoUrl: null };
  const edit = (fn: (d: Definition) => Definition) => change(fn(definition));

  const addWidget = (type: string) => {
    const created = newWidget(type);
    edit((d) => insertWidget(d, pageKey, created, widgetId));
    setWidgetId(created.id);
  };

  const selectPage = (key: string) => {
    setPageKey(key);
    setWidgetId(null);
  };

  const TABS: Array<{ key: Tab; label: string; icon: typeof FileStack }> = [
    { key: 'pages', label: 'Pages', icon: FileStack }, { key: 'journeys', label: 'Journeys', icon: Route },
    { key: 'data', label: 'Data', icon: Database }, { key: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="studio">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <StudioModeSwitch fallback={<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><AppWindow className="h-4 w-4" /></span>} />
        <Input
          aria-label="App name" value={definition.name} disabled={readOnly} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))}
          className="h-8 w-56 border-transparent bg-transparent px-2 text-[15px] font-semibold shadow-none hover:border-input focus-visible:border-input"
        />
        <SaveIndicator state={saveState} readOnly={readOnly} />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <ProblemsButton errors={errors} />
          {canManage && <Button size="sm" variant="ghost" onClick={() => setDialog('templates')} data-testid="open-templates"><LayoutTemplate className="h-4 w-4" />Templates</Button>}
          <VersionsMenu app={app} canPublish={canPublish} canManage={canManage} onActivate={activate} onRestore={restore} />
          <Button size="sm" variant="outline" asChild><a href={app.portalUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Open app</a></Button>
          {canPublish && (
            <Button size="sm" onClick={() => void publish()} disabled={publishing || errors.length > 0} data-testid="publish-app" title={errors.length ? 'Fix the problems first' : undefined}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Publish
            </Button>
          )}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left: structure */}
        <aside className="flex w-[272px] shrink-0 flex-col border-r bg-muted/20">
          <div className="grid grid-cols-4 gap-1 border-b p-2" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} data-testid={`studio-tab-${t.key}`}
                className={cn('flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors', tab === t.key ? 'bg-background text-primary shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:text-foreground')}>
                <t.icon className="h-4 w-4" />{t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
            {tab === 'pages' && (
              <>
                <PagesList definition={definition} current={pageKey} onSelect={selectPage} onAdd={() => setDialog('page')} readOnly={readOnly} />
                {page && (
                  <WidgetOutline
                    widgets={page.widgets} selected={widgetId} onSelect={setWidgetId} readOnly={readOnly} onAdd={addWidget}
                    onMove={(id, direction) => edit((d) => moveWidget(d, pageKey, id, direction))}
                    onDuplicate={(id) => { const result = duplicateWidget(definition, pageKey, id); change(result.definition); setWidgetId(result.id); }}
                    onRemove={(id) => { edit((d) => removeWidget(d, pageKey, id)); if (widgetId === id) setWidgetId(null); }}
                  />
                )}
              </>
            )}
            {tab === 'journeys' && <JourneysList definition={definition} workflows={workflows} selected={journeyKey} onSelect={setJourneyKey} onAdd={() => setDialog('journey')} readOnly={readOnly} />}
            {tab === 'data' && <CollectionsList definition={definition} selected={collection} onSelect={setCollection} onAdd={() => setDialog('collection')} readOnly={readOnly} />}
            {tab === 'settings' && <SettingsList selected={setting} onSelect={setSetting} />}
          </div>
        </aside>

        {/* Center: live preview */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
            <p className="min-w-0 truncate text-sm"><span className="text-muted-foreground">Page</span> <span className="font-medium">{pageLabel(definition, pageKey)}</span></p>
            <span className="flex items-center gap-2">
              <PreviewAs client={previewClient} onChange={setPreviewClient} allowed={hasPermission('clients:read')} />
              <DeviceToggle device={device} onChange={setDevice} />
            </span>
          </div>
          <Canvas
            definition={definition as AppDefinition} institution={institution} data={data} page={pageKey} selected={widgetId} device={device}
            onSelect={(id) => { setTab('pages'); setWidgetId(id); }}
            onNavigate={(key) => { if (definition.pages[key]) { setPageKey(key); setWidgetId(null); } }}
          />
        </div>

        {/* Right: inspector */}
        <aside className="w-[312px] shrink-0 overflow-y-auto border-l" data-testid="studio-inspector">
          {tab === 'pages' && widget && (
            <WidgetInspector
              key={widget.id} widget={widget} context={context} readOnly={readOnly}
              onChange={(next: ClientWidget) => edit((d) => updateWidget(d, pageKey, widget.id, () => next))}
              onRemove={() => { edit((d) => removeWidget(d, pageKey, widget.id)); setWidgetId(null); }}
            />
          )}
          {tab === 'pages' && !widget && page && (
            <PageInspector
              key={pageKey} definition={definition} pageKey={pageKey} onChange={change} readOnly={readOnly}
              onDelete={() => {
                const { [pageKey]: _removed, ...pages } = definition.pages;
                change({ ...definition, pages, navigation: definition.navigation.filter((n) => n.page !== pageKey), pageOrder: definition.pageOrder?.filter((k) => k !== pageKey) });
                setPageKey(definition.home);
              }}
              onRename={(key) => {
                if (!/^[a-z][a-z0-9_-]{0,47}$/.test(key) || definition.pages[key]) return toast.error('Keys are lower-case letters, digits, - and _, and unique');
                change(renamePageKey(definition, pageKey, key));
                setPageKey(key);
              }}
            />
          )}
          {tab === 'journeys' && (journeyKey && definition.journeys[journeyKey]
            ? <JourneyInspector key={journeyKey} definition={definition} journeyKey={journeyKey} context={context} onChange={change} readOnly={readOnly} />
            : <Hint icon={Route} title="Journeys" text="A journey is a workflow your clients start from the app: opening an account, moving money, a loan. Its client.screen steps are the screens they fill; review steps are your team's checks." />)}
          {tab === 'data' && (collection !== null && definition.collections[collection]
            ? <CollectionInspector definition={definition} index={collection} context={context} onChange={change} readOnly={readOnly} />
            : <Hint icon={Database} title="Data" text="Collections hold each client's records — accounts, cards, policies, orders. Widgets show them (records:<key>); your systems and workflows keep them up to date." />)}
          {tab === 'settings' && <SettingsInspector definition={definition} section={setting} context={context} onChange={change} readOnly={readOnly} portalUrl={app.portalUrl} />}
        </aside>
      </div>

      <NameDialog
        open={dialog === 'page'} title="New page" label="Title" onClose={() => setDialog(null)}
        onSubmit={(title) => {
          const key = keyFrom(title, Object.keys(definition.pages));
          change({ ...definition, pages: { ...definition.pages, [key]: { title, widgets: [] } } });
          setTab('pages');
          selectPage(key);
        }}
      />
      <NameDialog
        open={dialog === 'collection'} title="New collection" label="Name (e.g. Policies)" onClose={() => setDialog(null)}
        onSubmit={(label) => {
          const key = keyFrom(label, definition.collections.map((c) => c.key), 'data').replace(/-/g, '_');
          change({ ...definition, collections: [...definition.collections, { key, label, fields: [] }] });
          setCollection(definition.collections.length);
        }}
      />
      <NameDialog
        open={dialog === 'journey'} title="New journey" label="Title (e.g. Open a savings account)" onClose={() => setDialog(null)}
        workflows={workflows}
        onSubmit={(title, workflowId) => {
          const key = journeyKeyFrom(title, Object.keys(definition.journeys));
          change({ ...definition, journeys: { ...definition.journeys, [key]: { workflowId: workflowId ?? '', title, inputs: [], stages: [] } } });
          setJourneyKey(key);
        }}
      />
      <TemplatesDialog
        open={dialog === 'templates'} onClose={() => setDialog(null)}
        onInstalled={(next) => {
          queryClient.setQueryData(['client-app-studio'], next);
          const draft = normalize(next.draft);
          setDefinition(draft);
          setSaveState('saved');
          setPageKey(draft.home);
          setWidgetId(null);
        }}
      />
    </div>
  );
}

function NameDialog({ open, title, label, onClose, onSubmit, workflows }: {
  open: boolean; title: string; label: string; onClose: () => void; onSubmit: (value: string, workflowId?: string) => void; workflows?: Array<{ id: string; name: string; active: boolean }>;
}) {
  const [value, setValue] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  useEffect(() => { if (open) { setValue(''); setWorkflowId(''); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{workflows && <DialogDescription>Clients start it from the app; the workflow runs its screens and checks.</DialogDescription>}</DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!value.trim() || (workflows && !workflowId)) return; onSubmit(value.trim(), workflowId || undefined); onClose(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="studio-name">{label}</Label>
            <Input id="studio-name" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          {workflows && (
            <div className="space-y-1.5">
              <Label htmlFor="studio-workflow">Workflow</Label>
              <select id="studio-workflow" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Choose a workflow…</option>
                {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}{w.active ? '' : ' (not published)'}</option>)}
              </select>
            </div>
          )}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!value.trim() || (!!workflows && !workflowId)}>Add</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface AppTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Connections the template's workflows use (chosen at install). */
  requires?: Array<{ key: string; connector: string; label: string; description?: string }>;
  parameters?: Array<{ key: string; label: string; default: string }>;
}

function TemplatesDialog({ open, onClose, onInstalled }: { open: boolean; onClose: () => void; onInstalled: (app: StudioApp) => void }) {
  const { axios } = useAxios();
  const { data: templates = [] } = useApiQuery<AppTemplate[]>(['client-app-templates'], open ? '/client-apps/templates' : null);
  const [setup, setSetup] = useState<AppTemplate | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (!open) setSetup(null); }, [open]);
  const install = async (id: string, extra: { connections?: Record<string, string>; parameters?: Record<string, string> } = {}) => {
    setBusy(id);
    try {
      const { data } = await axios.post<StudioApp>(`${API_BASE_URL}/client-apps/current/template`, { template: id, ...extra });
      onInstalled(data);
      toast.success('Template loaded into the draft — publish when ready');
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {setup ? (
          <TemplateSetup template={setup} busy={busy === setup.id} onBack={() => setSetup(null)} onInstall={(extra) => void install(setup.id, extra)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Start from a template</DialogTitle>
              <DialogDescription>Replaces the draft (published versions stay). Templates with journeys also create their workflows.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col rounded-xl border p-4" data-testid="app-template" data-template={t.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{t.category}</p>
                  <p className="mt-1 font-semibold">{t.name}</p>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.description}</p>
                  {!!t.requires?.length && <p className="mt-2 text-xs text-muted-foreground">Uses: {t.requires.map((r) => r.label).join(', ')}</p>}
                  <Button size="sm" className="mt-4 self-start" disabled={!!busy} onClick={() => (t.requires?.length || t.parameters?.length ? setSetup(t) : void install(t.id))}>
                    {busy === t.id && <Loader2 className="h-4 w-4 animate-spin" />}Use this template
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Pick the connections (and settings) a template's workflows are wired to. */
function TemplateSetup({ template, busy, onBack, onInstall }: { template: AppTemplate; busy: boolean; onBack: () => void; onInstall: (extra: { connections: Record<string, string>; parameters: Record<string, string> }) => void }) {
  const { data: connections = [] } = useApiQuery<Array<{ id: string; connectorId: string; displayName: string | null; connectorName: string; status: string }>>(['integrations'], '/integrations');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [parameters, setParameters] = useState<Record<string, string>>(() => Object.fromEntries((template.parameters ?? []).map((p) => [p.key, p.default])));
  // Preselect: the only connection of a kind, or (same connector twice) the one whose name matches best.
  useEffect(() => {
    setChosen((current) => {
      const next = { ...current };
      for (const need of template.requires ?? []) {
        if (next[need.key]) continue;
        const options = connections.filter((c) => c.connectorId === need.connector);
        const words = need.label.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
        const named = options.find((c) => words.some((w) => (c.displayName ?? '').toLowerCase().includes(w)));
        if (named || options.length === 1) next[need.key] = (named ?? options[0]).id;
      }
      return next;
    });
  }, [connections, template]);
  const missing = (template.requires ?? []).filter((need) => !chosen[need.key]);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{template.name}: connect it to your systems</DialogTitle>
        <DialogDescription>The template's workflows use these connections. Missing one? Add it under Integrations first.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!missing.length) onInstall({ connections: chosen, parameters }); }} data-testid="template-setup">
        <div className="space-y-3">
          {(template.requires ?? []).map((need) => {
            const options = connections.filter((c) => c.connectorId === need.connector);
            return (
              <div key={need.key} className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center">
                <Label htmlFor={`need-${need.key}`} className="leading-snug">{need.label}{need.description && <span className="block text-xs font-normal text-muted-foreground">{need.description}</span>}</Label>
                <select id={`need-${need.key}`} data-testid={`need-${need.key}`} value={chosen[need.key] ?? ''} onChange={(e) => setChosen({ ...chosen, [need.key]: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">{options.length ? 'Choose a connection…' : `No ${need.connector} connection yet`}</option>
                  {options.map((c) => <option key={c.id} value={c.id}>{c.displayName || c.connectorName}</option>)}
                </select>
              </div>
            );
          })}
          {(template.parameters ?? []).map((p) => (
            <div key={p.key} className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center">
              <Label htmlFor={`param-${p.key}`}>{p.label}</Label>
              <Input id={`param-${p.key}`} data-testid={`param-${p.key}`} value={parameters[p.key] ?? ''} onChange={(e) => setParameters({ ...parameters, [p.key]: e.target.value })} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
          <Button type="submit" disabled={busy || missing.length > 0} data-testid="template-install">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Install the template</Button>
        </DialogFooter>
      </form>
    </>
  );
}
