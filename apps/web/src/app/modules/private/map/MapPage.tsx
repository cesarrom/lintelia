import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import ReactFlow, {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, Panel, ReactFlowProvider, applyNodeChanges, useReactFlow,
  type NodeChange, type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Layers, LayoutGrid, Loader2, Map as MapIcon, Maximize, Search, UserRound } from 'lucide-react';
import type { ClientWidget } from '@repo/fintivio/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/lib/auth/AuthContext';
import { apiErrorMessage, useApiQuery } from '@/lib/services/api';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { RuntimeProvider, WidgetFrameProvider, type AppRuntime } from '@/client-app/runtime';
import { sampleData, sampleMe } from '@/client-app/sample-data';
import type { AppData } from '@/client-app/types';
import { MapContext, useMap, type MapContextValue } from './context';
import { EDGE_TYPES } from './edges';
import { buildGraph, layoutMap, personaSegments, type EdgeKind, type MapEdge, type MapNode } from './graph';
import { Inspector, nodeTitle } from './Inspector';
import { edgeColor, NODE_TYPES } from './nodes';
import type { MapData } from './types';

/**
 * The experience map (docs/plans/13): everything an institution built for its clients on one canvas, like a design
 * file — the app's layout and pages (real widgets, a sample client), the journeys with the screens and requests their
 * workflows show, what happens in between, the workflows, functions, forms and events behind them, all connected by
 * arrows. Click a link inside a frame to follow it; double-click a frame (or "Edit") to open its editor; the editors
 * have a way back.
 */
export default function MapPage() {
  return (
    <ReactFlowProvider>
      <MapCanvas />
    </ReactFlowProvider>
  );
}

type Layer = 'nav' | 'links' | 'journeys' | 'automations' | 'notify';
const LAYERS: Array<{ key: Layer; label: string; kinds: EdgeKind[] }> = [
  { key: 'nav', label: 'Menu', kinds: ['nav'] },
  { key: 'links', label: 'Links between pages and journeys', kinds: ['link', 'journey'] },
  { key: 'journeys', label: 'Journey screens and flow', kinds: ['flow', 'runs'] },
  { key: 'automations', label: 'Automations, functions, forms', kinds: ['call', 'trigger', 'form'] },
  { key: 'notify', label: 'Notifications and “when done”', kinds: ['notify', 'done'] },
];
const LEGEND: Array<{ kind: EdgeKind; label: string }> = [
  { kind: 'nav', label: 'Menu entry' }, { kind: 'link', label: 'Opens a page' }, { kind: 'journey', label: 'Starts a journey' }, { kind: 'flow', label: 'Journey flow' },
  { kind: 'runs', label: 'Runs a workflow' }, { kind: 'call', label: 'Uses a function / workflow' }, { kind: 'trigger', label: 'Event starts a workflow' },
  { kind: 'form', label: 'Form' }, { kind: 'notify', label: 'Notification opens a page' },
];

const storage = (tenant: string, what: string) => `fintivio.map.${what}.${tenant}`;
const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

function MapCanvas() {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const tenantKey = tenant?.domain ?? 'tenant';
  const { theme } = useTheme();
  const rf = useReactFlow();
  const { data, error, isLoading } = useApiQuery<MapData>(['experience-map'], '/experience-map');

  // The graph (structure) and the nodes (with positions).
  const graph = useMemo(() => (data ? buildGraph(data) : null), [data]);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const measured = useRef<Record<string, { width: number; height: number }>>({});
  const [settled, setSettled] = useState(false);
  const layoutRun = useRef(0);
  const saved = useRef<Record<string, { x: number; y: number }>>(read(storage(tenantKey, 'positions'), {}));

  const applyLayout = useCallback(async (final: boolean, keepSaved = true) => {
    if (!graph) return;
    const run = ++layoutRun.current;
    const positions = await layoutMap(graph.nodes, graph.edges, measured.current);
    if (run !== layoutRun.current) return;
    setNodes((current) => graph.nodes.map((n) => {
      const previous = current.find((c) => c.id === n.id);
      const position = (keepSaved && saved.current[n.id]) || positions.get(n.id) || previous?.position || n.position;
      return { ...n, ...(previous ? { width: previous.width, height: previous.height } : {}), position, style: { ...n.style, visibility: final || previous?.width ? 'visible' : 'hidden' } };
    }));
    if (final) setSettled(true);
  }, [graph]);

  useEffect(() => {
    setSettled(false);
    void applyLayout(false);
  }, [applyLayout]);

  // Once the frames have their real sizes (pages render their widgets), lay out again with them.
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    let resized = false;
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) {
        const before = measured.current[change.id];
        if (!before || Math.abs(before.height - change.dimensions.height) > 24 || Math.abs(before.width - change.dimensions.width) > 24) resized = true;
        measured.current[change.id] = change.dimensions;
      }
    }
    setNodes((current) => applyNodeChanges(changes, current) as MapNode[]);
    if (resized && !settled) {
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => void applyLayout(true), 700);
    }
  }, [applyLayout, settled]);

  // Where the view was (coming back from an editor), else fit everything once laid out.
  const restored = useRef(false);
  useEffect(() => {
    if (!settled || restored.current) return;
    restored.current = true;
    const viewport = read<Viewport | null>(storage(tenantKey, 'viewport'), null);
    if (viewport) rf.setViewport(viewport);
    // First visit: the app (layout and pages); the journeys and automations are a scroll away.
    else rf.fitView({ padding: 0.06, duration: 400, nodes: rf.getNodes().filter((n) => n.id === 'layout' || n.type === 'page') });
  }, [settled, rf, tenantKey]);

  // Persona: the sample client's segments (widgets, menu entries and pages with rules show faded when hidden).
  const segments = useMemo(() => (data ? personaSegments(data.app.definition) : []), [data]);
  const [persona, setPersona] = useState<string>('');
  const [appData, setAppData] = useState<AppData | null>(null);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      const definition = data.app.definition;
      const me = { ...sampleMe(definition), segments: persona ? [persona] : [] };
      const sample = await sampleData(definition, me);
      // The map shows every journey a widget may start, whoever the sample client is.
      const journeys = Object.entries(definition.journeys ?? {}).filter(([, j]) => !j.hidden).map(([key, j]) => ({ key, title: j.title, description: j.description ?? null, icon: j.icon ?? null, category: j.category ?? null }));
      if (!cancelled) setAppData({ ...sample, journeys });
    })();
    return () => { cancelled = true; };
  }, [data, persona]);

  // Selection, focus, following links (with a way back), layers.
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredWidget, setHoveredWidget] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<Layer, boolean>>(() => read(storage(tenantKey, 'layers'), { nav: true, links: true, journeys: true, automations: true, notify: false }));
  useEffect(() => localStorage.setItem(storage(tenantKey, 'layers'), JSON.stringify(layers)), [layers, tenantKey]);
  const [history, setHistory] = useState<Viewport[]>([]);

  const visibleEdges = useMemo<MapEdge[]>(() => {
    if (!graph) return [];
    const kinds = new Set(LAYERS.filter((l) => layers[l.key]).flatMap((l) => l.kinds));
    return graph.edges.filter((e) => kinds.has(e.data!.kind)).map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(e.data!.kind), width: 16, height: 16 } }));
  }, [graph, layers]);

  const hiddenNodes = useMemo(() => {
    if (!graph) return new Set<string>();
    const hidden = new Set<string>();
    for (const n of graph.nodes) {
      if (!layers.journeys && ['touchpoint', 'process', 'end'].includes(n.data.kind)) hidden.add(n.id);
      if (!layers.automations && (n.id === 'region:automations' || n.data.kind === 'trigger' || n.data.kind === 'form' || (n.data.kind === 'workflow' && n.data.role === 'automation'))) hidden.add(n.id);
    }
    return hidden;
  }, [graph, layers]);

  const focus = useMemo(() => {
    const around = (ids: Set<string>, edgeFilter: (e: MapEdge) => boolean) => {
      const edges = visibleEdges.filter(edgeFilter);
      const nodeIds = new Set(ids);
      for (const e of edges) { nodeIds.add(e.source); nodeIds.add(e.target); }
      return { nodes: nodeIds, edges: new Set(edges.map((e) => e.id)) };
    };
    if (hoveredWidget) return around(new Set(), (e) => e.sourceHandle === `w:${hoveredWidget}`);
    if (selected) return around(new Set([selected]), (e) => e.source === selected || e.target === selected);
    return null;
  }, [selected, hoveredWidget, visibleEdges]);

  const follow = useCallback((id: string) => {
    const node = rf.getNode(id);
    if (!node) return;
    if (hiddenNodes.has(id)) {
      toast.info('That part of the map is hidden', { description: 'Turn its layer on to see it.' });
      return;
    }
    setHistory((h) => [...h.slice(-30), rf.getViewport()]);
    const width = node.width ?? 300;
    const height = node.height ?? 200;
    const zoom = Math.max(rf.getZoom(), 0.62);
    // Leave room for the inspector on the right.
    rf.setCenter(node.position.x + width / 2 + 170 / zoom, node.position.y + Math.min(height / 2, 380), { zoom, duration: 650 });
    setSelected(id);
  }, [rf, hiddenNodes]);

  const back = useCallback(() => {
    setHistory((h) => {
      const previous = h.at(-1);
      if (previous) rf.setViewport(previous, { duration: 500 });
      return h.slice(0, -1);
    });
  }, [rf]);

  const open = useCallback((id: string, detail?: { step?: string }) => {
    localStorage.setItem(storage(tenantKey, 'viewport'), JSON.stringify(rf.getViewport()));
    const node = graph?.nodes.find((n) => n.id === id);
    const d = node?.data;
    if (!d) return;
    const step = detail?.step ? `&step=${encodeURIComponent(detail.step)}` : '';
    if (d.kind === 'page') navigate(`/app/experience?page=${encodeURIComponent(d.pageKey)}&from=map`);
    else if (d.kind === 'journey') navigate(`/app/experience?journey=${encodeURIComponent(d.journeyKey)}&from=map`);
    else if (d.kind === 'layout') navigate('/app/experience?tab=settings&from=map');
    else if (d.kind === 'workflow') navigate(`/app/workflows/${d.workflow.id}?from=map${step}`);
    else if (d.kind === 'touchpoint') navigate(`/app/workflows/${d.workflowId}?from=map${step}`);
    else if (d.kind === 'process') navigate(`/app/workflows/${d.workflowId}?from=map${step}`);
    else if (d.kind === 'form') navigate(`/app/forms?edit=${d.form.id}&from=map`);
  }, [graph, navigate, rf, tenantKey]);

  const linkedWidgets = useMemo(() => new Set(visibleEdges.map((e) => e.sourceHandle).filter((h): h is string => !!h && h.startsWith('w:')).map((h) => h.slice(2))), [visibleEdges]);

  const context = useMemo<MapContextValue | null>(() => (data ? {
    data, definition: data.app.definition, institution: data.institution, appData, edges: visibleEdges, selected, focus, hoveredWidget,
    follow, select: setSelected, open, hoverWidget: setHoveredWidget,
  } : null), [data, appData, visibleEdges, selected, focus, hoveredWidget, follow, open]);

  // The client-app runtime of the frames: links follow their arrows instead of navigating.
  const runtime = useMemo<AppRuntime | null>(() => (data ? {
    definition: data.app.definition, institution: data.institution, mode: 'preview', starting: null,
    openPage: (page) => follow(`page:${page}`),
    startJourney: async (journey) => follow(`journey:${journey}`),
    openCase: () => toast.info('Opens the client’s application in the live app'),
  } : null), [data, follow]);

  const frame = useCallback((widget: ClientWidget, _path: string, element: ReactNode) => (
    <MapWidget widget={widget} linked={linkedWidgets.has(widget.id)}>{element}</MapWidget>
  ), [linkedWidgets]);

  const shownNodes = useMemo(() => nodes.filter((n) => !hiddenNodes.has(n.id)).map((n) => (n.id === selected ? { ...n, selected: true } : n)), [nodes, hiddenNodes, selected]);

  if (error) return <div className="p-8"><Alert variant="destructive"><AlertDescription>{apiErrorMessage(error)}</AlertDescription></Alert></div>;
  if (isLoading || !data || !context || !runtime) {
    return <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Drawing the map…</div>;
  }
  const selectedNode = selected ? nodes.find((n) => n.id === selected) : undefined;

  return (
    <MapContext.Provider value={context}>
      <RuntimeProvider runtime={runtime}>
        <WidgetFrameProvider value={frame}>
          <div className="relative h-full w-full bg-canvas" data-testid="experience-map" data-settled={settled || undefined}>
            <ReactFlow
              nodes={shownNodes}
              edges={visibleEdges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodesChange={onNodesChange}
              onNodeClick={(_, node) => { if (node.data.kind !== 'region') setSelected(node.id); }}
              onNodeDoubleClick={(_, node) => open(node.id)}
              onPaneClick={() => setSelected(null)}
              onNodeDragStop={(_, node) => {
                saved.current = { ...saved.current, [node.id]: node.position };
                localStorage.setItem(storage(tenantKey, 'positions'), JSON.stringify(saved.current));
              }}
              onMoveEnd={(_, viewport) => { if (settled) localStorage.setItem(storage(tenantKey, 'viewport'), JSON.stringify(viewport)); }}
              minZoom={0.04}
              maxZoom={1.6}
              nodesConnectable={false}
              elementsSelectable
              selectNodesOnDrag={false}
              zoomOnDoubleClick={false}
              panOnScroll
              zoomOnPinch
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color={theme === 'dark' ? '#2c3149' : '#c9cede'} />
              <MiniMap pannable zoomable position="bottom-left" style={{ width: 170, height: 110 }} className="!mb-3 !ml-14 !rounded-xl !border !bg-background/90" nodeColor={(n) => minimapColor(n as MapNode)} maskColor={theme === 'dark' ? 'rgba(10,12,20,0.6)' : 'rgba(240,242,248,0.65)'} />
              <Controls showInteractive={false} className="!bottom-3 !left-3 !rounded-lg !border !shadow-sm" />
              <Panel position="top-left" className="!m-3">
                <Toolbar
                  nodes={nodes} persona={persona} segments={segments} onPersona={setPersona} layers={layers} onLayers={setLayers}
                  canGoBack={history.length > 0} onBack={back}
                  onTidy={() => { saved.current = {}; localStorage.removeItem(storage(tenantKey, 'positions')); void applyLayout(true, false).then(() => rf.fitView({ padding: 0.08, duration: 500 })); }}
                  onFit={() => rf.fitView({ padding: 0.08, duration: 500 })}
                />
              </Panel>
              <Panel position="bottom-right" className={cn('!m-3', selectedNode && '!mr-[360px]')}><Legend /></Panel>
            </ReactFlow>
            {!settled && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm"><Loader2 className="h-4 w-4 animate-spin" />Laying out your screens…</span>
              </div>
            )}
            {selectedNode && selectedNode.data.kind !== 'region' && <Inspector node={selectedNode} nodes={nodes} onClose={() => setSelected(null)} />}
          </div>
        </WidgetFrameProvider>
      </RuntimeProvider>
    </MapContext.Provider>
  );
}

function minimapColor(node: MapNode) {
  switch (node.data.kind) {
    case 'page': case 'layout': return '#6366f1';
    case 'journey': return '#8b5cf6';
    case 'touchpoint': return '#0ea5e9';
    case 'workflow': return node.data.workflow.function ? '#14b8a6' : '#f59e0b';
    case 'trigger': return '#ec4899';
    case 'form': return '#10b981';
    case 'region': return 'transparent';
    default: return '#94a3b8';
  }
}

/** A widget inside a page frame: hovering one that leads somewhere lights up its arrows. */
function MapWidget({ widget, linked, children }: { widget: ClientWidget; linked: boolean; children: ReactNode }) {
  const { hoveredWidget, hoverWidget } = useMap();
  return (
    <div
      className={cn('relative rounded-2xl outline-offset-4 transition-[outline-color]', linked ? 'outline outline-2 outline-transparent hover:outline-[#6366f1]/60' : '', hoveredWidget === widget.id && 'outline-[#6366f1]')}
      onMouseEnter={linked ? () => hoverWidget(widget.id) : undefined}
      onMouseLeave={linked ? () => hoverWidget(null) : undefined}
      data-map-widget={widget.id}
    >
      {children}
    </div>
  );
}

function Toolbar({ nodes, persona, segments, onPersona, layers, onLayers, canGoBack, onBack, onTidy, onFit }: {
  nodes: MapNode[]; persona: string; segments: string[]; onPersona: (p: string) => void;
  layers: Record<Layer, boolean>; onLayers: (l: Record<Layer, boolean>) => void;
  canGoBack: boolean; onBack: () => void; onTidy: () => void; onFit: () => void;
}) {
  const { data, definition, follow } = useMap();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => n.data.kind !== 'region' && n.data.kind !== 'process').map((n) => ({ id: n.id, kind: n.data.kind, title: nodeTitle(n, definition) }))
      .filter((r) => r.title.toLowerCase().includes(q)).slice(0, 12);
  }, [query, nodes, definition]);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-1.5 shadow-raised backdrop-blur" data-testid="map-toolbar">
      <div className="flex items-center gap-2 px-2">
        <MapIcon className="h-4 w-4 text-primary" />
        <span className="text-[14px] font-semibold">{data.app.name ?? 'Your app'}</span>
        {data.app.errors.length > 0 && (
          <span title={data.app.errors.join('\n')} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" />{data.app.errors.length} to fix
          </span>
        )}
      </div>
      {canGoBack && <Button size="sm" variant="outline" className="h-8" onClick={onBack} data-testid="map-back"><ArrowLeft className="h-3.5 w-3.5" />Back</Button>}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a page, journey, workflow…" className="h-8 w-60 pl-8 text-[13px]" data-testid="map-search" />
        {results.length > 0 && (
          <ul className="absolute left-0 top-full z-20 mt-1 w-80 overflow-hidden rounded-xl border bg-popover p-1 shadow-raised">
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-muted" onClick={() => { follow(r.id); setQuery(''); }} data-testid="map-search-result">
                  <span className="w-20 shrink-0 text-[11px] text-muted-foreground">{r.kind}</span><span className="truncate">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-[13px]" title="The sample client the pages are drawn for: widgets they would not see are faded">
        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
        <select value={persona} onChange={(e) => onPersona(e.target.value)} className="bg-transparent outline-none" data-testid="map-persona">
          <option value="">New client (no segment)</option>
          {segments.map((s) => <option key={s} value={s}>As a “{s}”</option>)}
        </select>
      </label>
      <Popover>
        <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-8"><Layers className="h-3.5 w-3.5" />Layers</Button></PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-1 p-2">
          {LAYERS.map((l) => (
            <label key={l.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted">
              <input type="checkbox" checked={layers[l.key]} onChange={(e) => onLayers({ ...layers, [l.key]: e.target.checked })} data-testid={`map-layer-${l.key}`} />
              <span className="h-2 w-2 rounded-full" style={{ background: edgeColor(l.kinds[0]) }} />{l.label}
            </label>
          ))}
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="ghost" className="h-8" onClick={onTidy} title="Lay everything out again (forgets where you moved things)"><LayoutGrid className="h-3.5 w-3.5" />Tidy up</Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onFit}><Maximize className="h-3.5 w-3.5" />Fit</Button>
    </div>
  );
}

function Legend() {
  return (
    <details className="rounded-xl border bg-background/95 px-3 py-2 text-[12px] shadow-sm backdrop-blur">
      <summary className="cursor-pointer select-none font-medium">Legend</summary>
      <ul className="mt-2 space-y-1">
        {LEGEND.map((l) => (
          <li key={l.kind} className="flex items-center gap-2">
            <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke={edgeColor(l.kind)} strokeWidth="2.5" strokeDasharray={['notify', 'done', 'nav'].includes(l.kind) ? '5 4' : undefined} /></svg>{l.label}
          </li>
        ))}
      </ul>
      <p className="mt-2 max-w-[220px] text-muted-foreground">Click a button inside a screen to follow its arrow. Double-click a frame to edit it.</p>
    </details>
  );
}
