import ELK from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from 'reactflow';
import { ordered, walkWidgets, type ClientWidget } from '@repo/fintivio/schemas';
import type { AppDefinition } from '@/client-app/types';
import type { MapData, MapEnd, MapForm, MapTouchpoint, MapViaStep, MapWorkflow } from './types';

/**
 * The experience map as a graph (docs/plans/13). One canvas, four regions:
 *  - the app: its layout (the shared shell, navigation once) and its pages as frames;
 *  - journeys: one row each — the journey, the touchpoints its workflow shows the client (screens, requests, vendor
 *    pages) in order, what happens in between (process nodes), how it ends, and the workflow that runs it;
 *  - automations: workflows started by events (with the event), functions and sub-workflows, forms.
 * Arrows: navigation, links from widgets, journeys started from widgets, the flow between touchpoints, workflow calls,
 * triggers, forms, notifications that open pages.
 */

export type EdgeKind = 'nav' | 'link' | 'journey' | 'flow' | 'runs' | 'call' | 'trigger' | 'form' | 'notify' | 'done';

export type MapNodeData =
  | { kind: 'region'; title: string; subtitle?: string }
  | { kind: 'layout' }
  | { kind: 'page'; pageKey: string; links: WidgetLink[]; orphan: boolean; home: boolean; inNav: boolean }
  | { kind: 'journey'; journeyKey: string; workflowId: string | null; reachable: boolean }
  | { kind: 'touchpoint'; journeyKey: string; workflowId: string; touchpoint: MapTouchpoint; first: boolean }
  | { kind: 'process'; workflowId: string; via: MapViaStep[]; targets: number }
  | { kind: 'end'; end: MapEnd }
  | { kind: 'workflow'; workflow: MapWorkflow; role: 'journey' | 'automation' }
  | { kind: 'trigger'; event: string; label: string; source: string }
  | { kind: 'form'; form: MapForm }
  | { kind: 'missing'; label: string };

export type MapNode = Node<MapNodeData>;
export interface MapEdgeData { kind: EdgeKind; label?: string; sublabel?: string }
export type MapEdge = Edge<MapEdgeData>;

export interface WidgetLink { widgetId: string; widgetType: string; kind: 'page' | 'journey' | 'url'; target: string; label: string }

export const PAGE_WIDTH = 760;
export const SCREEN_WIDTH = 440;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Where each widget of a page leads: pages, journeys, web addresses (quick actions may lead to several). */
export function widgetLinks(widgets: ClientWidget[], definition: AppDefinition): WidgetLink[] {
  const links: WidgetLink[] = [];
  const add = (widget: ClientWidget, target: { page?: unknown; journey?: unknown; url?: unknown }, label: string) => {
    if (str(target.journey)) links.push({ widgetId: widget.id, widgetType: widget.type, kind: 'journey', target: str(target.journey), label });
    else if (str(target.page)) links.push({ widgetId: widget.id, widgetType: widget.type, kind: 'page', target: str(target.page), label });
    else if (str(target.url)) links.push({ widgetId: widget.id, widgetType: widget.type, kind: 'url', target: str(target.url), label });
  };
  walkWidgets(widgets, (widget) => {
    const p = (widget.props ?? {}) as Record<string, any>;
    const title = str(p.label) || str(p.action) || str(p.title) || widget.type;
    switch (widget.type) {
      case 'quick-actions':
        for (const action of Array.isArray(p.actions) ? p.actions : []) add(widget, action ?? {}, str(action?.label) || 'Action');
        break;
      case 'payment-cards':
        if (str(p.freezeJourney)) add(widget, { journey: p.freezeJourney }, 'Freeze');
        if (str(p.lostJourney)) add(widget, { journey: p.lostJourney }, 'Report lost');
        break;
      case 'journeys':
        for (const [key, journey] of ordered(definition.journeys ?? {}, definition.journeyOrder)) {
          if (!journey.hidden && (!str(p.category) || journey.category === p.category)) add(widget, { journey: key }, journey.title);
        }
        break;
      default:
        add(widget, p, title.startsWith('=') || title.includes('{{') ? widget.type : title);
    }
  });
  return links;
}

/** Segments the app's rules talk about (`'dealer' in me.segments`): the personas to preview as. */
export function personaSegments(definition: AppDefinition): string[] {
  const text = JSON.stringify({ pages: definition.pages, navigation: definition.navigation, journeys: definition.journeys });
  return [...new Set([...text.matchAll(/'([a-z0-9_-]+)'\s+in\s+(?:me\.)?segments/gi)].map((m) => m[1]))].sort();
}

/** A platform event in words. */
export function triggerLabel(event: string): { label: string; source: string } {
  const connector = /^connector:([^/]+)\/(.+)$/.exec(event);
  if (connector) {
    const [, id, type] = connector;
    const hook = /^webhook\.(.+)$/.exec(type);
    return hook ? { label: `Webhook “${hook[1]}”`, source: `${id === 'http' ? 'HTTP API' : id} connection` } : { label: type.replace(/[._]/g, ' '), source: id === 'loanpro' ? 'LoanPro' : id };
  }
  if (event.startsWith('api:')) return { label: event.slice(4).replace(/[._]/g, ' '), source: 'Your systems (API)' };
  const known: Record<string, string> = { 'client.registered': 'A client signs up or is registered', 'client.flagged': 'A client is flagged' };
  return { label: known[event] ?? event, source: 'Platform' };
}

const significant = (via: MapViaStep[]) => via.some((v) => v.group !== 'auto');

/** Nodes and edges (positions come from `layoutMap`). */
export function buildGraph(data: MapData): { nodes: MapNode[]; edges: MapEdge[] } {
  const definition = data.app.definition;
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const byId = new Map(data.workflows.map((w) => [w.id, w]));
  const node = (id: string, payload: MapNodeData, extra: Partial<MapNode> = {}) => nodes.push({ id, type: payload.kind, position: { x: 0, y: 0 }, data: payload, ...extra });
  const edge = (source: string, target: string, kind: EdgeKind, extra: Partial<MapEdge> & { label?: string; sublabel?: string } = {}) => {
    const { label, sublabel, ...rest } = extra;
    edges.push({ id: `${kind}:${source}:${rest.sourceHandle ?? ''}->${target}:${edges.length}`, source, target, type: 'map', data: { kind, label, sublabel }, ...rest });
  };

  const pages = ordered(definition.pages ?? {}, definition.pageOrder);
  const navPages = new Set(definition.navigation.map((n) => n.page));
  const pageOrder = [...pages].sort(([a], [b]) => (a === definition.home ? -1 : b === definition.home ? 1 : 0)
    || ((navPages.has(a) ? definition.navigation.findIndex((n) => n.page === a) : 999) - (navPages.has(b) ? definition.navigation.findIndex((n) => n.page === b) : 999)));
  const links = new Map(pageOrder.map(([key, page]) => [key, widgetLinks(page.widgets ?? [], definition)]));
  const linkedPages = new Set([...links.values()].flat().filter((l) => l.kind === 'page').map((l) => l.target));
  const linkedJourneys = new Set([...links.values()].flat().filter((l) => l.kind === 'journey').map((l) => l.target));

  // --- the app ---------------------------------------------------------------------------------------------------------
  node('region:app', { kind: 'region', title: data.app.name ?? 'Client app', subtitle: 'Layout and pages — what clients see' }, { selectable: false, draggable: false });
  node('layout', { kind: 'layout' }, { dragHandle: '.map-drag' });
  definition.navigation.forEach((item, i) => {
    if (definition.pages[item.page]) edge('layout', `page:${item.page}`, 'nav', { sourceHandle: `n:${i}`, label: item.label });
  });
  for (const [key] of pageOrder) {
    node(`page:${key}`, { kind: 'page', pageKey: key, links: links.get(key) ?? [], home: key === definition.home, inNav: navPages.has(key), orphan: key !== definition.home && !navPages.has(key) && !linkedPages.has(key) }, { dragHandle: '.map-drag' });
  }
  for (const [key, list] of links) {
    for (const link of list) {
      if (link.kind === 'url') continue;
      const target = link.kind === 'page' ? `page:${link.target}` : `journey:${link.target}`;
      if (link.kind === 'page' && !definition.pages[link.target]) continue;
      if (link.kind === 'journey' && !definition.journeys?.[link.target]) continue;
      edge(`page:${key}`, target, link.kind === 'page' ? 'link' : 'journey', { sourceHandle: `w:${link.widgetId}`, label: link.label });
    }
  }

  // --- journeys ----------------------------------------------------------------------------------------------------------
  const journeyWorkflows = new Set<string>();
  const journeys = ordered(definition.journeys ?? {}, definition.journeyOrder);
  if (journeys.length) node('region:journeys', { kind: 'region', title: 'Journeys', subtitle: 'What clients do: each journey’s screens and requests, in the order its workflow shows them' }, { selectable: false, draggable: false });
  for (const [key, journey] of journeys) {
    const workflow = byId.get(journey.workflowId);
    node(`journey:${key}`, { kind: 'journey', journeyKey: key, workflowId: workflow?.id ?? null, reachable: linkedJourneys.has(key) || !journey.hidden }, { dragHandle: '.map-drag' });
    if (journey.donePage && definition.pages[journey.donePage]) edge(`journey:${key}`, `page:${journey.donePage}`, 'done', { sourceHandle: 'done', label: 'When done' });
    if (!workflow) {
      node(`missing:${key}`, { kind: 'missing', label: 'The workflow of this journey does not exist' });
      edge(`journey:${key}`, `missing:${key}`, 'runs', { sourceHandle: 'runs', targetHandle: 'top', label: 'Runs' });
      continue;
    }
    journeyWorkflows.add(workflow.id);
    const prefix = `j:${key}:`;
    for (const tp of workflow.touchpoints) {
      node(`${prefix}tp:${tp.stepId}`, { kind: 'touchpoint', journeyKey: key, workflowId: workflow.id, touchpoint: tp, first: workflow.flow.some((f) => f.from === '@start' && f.to === tp.stepId) }, { dragHandle: '.map-drag' });
    }
    for (const end of workflow.ends) node(`${prefix}${end.id}`, { kind: 'end', end });
    const target = (to: string) => (to.startsWith('@end:') ? `${prefix}${to}` : `${prefix}tp:${to}`);
    const groups = new Map<string, typeof workflow.flow>();
    for (const f of workflow.flow) groups.set(`${f.from}|${f.event}`, [...(groups.get(`${f.from}|${f.event}`) ?? []), f]);
    for (const [groupKey, group] of groups) {
      const first = group[0];
      const source = first.from === '@start' ? `journey:${key}` : `${prefix}tp:${first.from}`;
      const sourceHandle = first.from === '@start' ? 'start' : `e:${first.event}`;
      const via = group.flatMap((f) => f.via).filter((v, i, all) => all.findIndex((x) => x.stepId === v.stepId) === i);
      if (significant(via)) {
        const processId = `${prefix}proc:${groupKey}`;
        node(processId, { kind: 'process', workflowId: workflow.id, via, targets: group.length });
        edge(source, processId, 'flow', { sourceHandle, label: first.from === '@start' ? undefined : first.eventLabel });
        for (const f of group) edge(processId, target(f.to), 'flow', { label: group.length > 1 ? f.branch?.split(': ').slice(1).join(': ') : undefined, sublabel: group.length > 1 ? f.branch?.split(': ')[0] : undefined });
      } else {
        for (const f of group) edge(source, target(f.to), 'flow', { sourceHandle, label: first.from === '@start' ? f.branch : f.eventLabel, sublabel: first.from === '@start' ? undefined : f.branch });
      }
    }
    node(`wf:${workflow.id}`, { kind: 'workflow', workflow, role: 'journey' }, { dragHandle: '.map-drag' });
    edge(`journey:${key}`, `wf:${workflow.id}`, 'runs', { sourceHandle: 'runs', targetHandle: 'top', label: 'Runs' });
  }

  // --- automations: everything else, with what starts it ---------------------------------------------------------------
  const rest = data.workflows.filter((w) => !journeyWorkflows.has(w.id));
  if (rest.length || data.forms.length) node('region:automations', { kind: 'region', title: 'Automations', subtitle: 'Workflows started by events and forms, functions and sub-workflows' }, { selectable: false, draggable: false });
  for (const workflow of rest) node(`wf:${workflow.id}`, { kind: 'workflow', workflow, role: 'automation' }, { dragHandle: '.map-drag' });
  const triggers = new Set(data.workflows.flatMap((w) => w.startOn));
  for (const event of triggers) {
    const { label, source } = triggerLabel(event);
    node(`trigger:${event}`, { kind: 'trigger', event, label, source });
  }
  for (const workflow of data.workflows) {
    for (const event of workflow.startOn) edge(`trigger:${event}`, `wf:${workflow.id}`, 'trigger', { label: 'Starts' });
    const seen = new Set<string>();
    for (const call of workflow.calls) {
      if (!byId.has(call.workflowId) || seen.has(call.workflowId)) continue;
      seen.add(call.workflowId);
      edge(`wf:${workflow.id}`, `wf:${call.workflowId}`, 'call', { sourceHandle: 'out', label: call.kind === 'function' ? 'Uses' : call.wait ? 'Runs' : 'Starts', sublabel: call.name });
    }
    for (const form of workflow.forms) if (data.forms.some((f) => f.id === form.formId)) edge(`wf:${workflow.id}`, `form:${form.formId}`, 'form', { sourceHandle: 'out', label: 'Sends', sublabel: form.name });
    const notified = new Set<string>();
    for (const notify of workflow.notifies) {
      if (!definition.pages[notify.page] || notified.has(notify.page)) continue;
      notified.add(notify.page);
      edge(`wf:${workflow.id}`, `page:${notify.page}`, 'notify', { sourceHandle: 'out', label: 'Notifies', sublabel: notify.title });
    }
  }
  for (const form of data.forms) {
    node(`form:${form.id}`, { kind: 'form', form });
    if (form.workflowId && byId.has(form.workflowId)) edge(`form:${form.id}`, `wf:${form.workflowId}`, 'form', { sourceHandle: 'out', label: 'Starts' });
  }
  return { nodes, edges };
}

/** Sizes before a node is measured. */
function estimate(node: MapNode): { width: number; height: number } {
  const d = node.data;
  switch (d.kind) {
    case 'layout': return { width: 280, height: 420 };
    case 'page': return { width: PAGE_WIDTH + 2, height: 900 };
    case 'journey': return { width: 300, height: 200 };
    case 'touchpoint': return { width: SCREEN_WIDTH + 2, height: d.touchpoint.kind === 'screen' ? 240 + d.touchpoint.fields.length * 86 : 320 };
    case 'process': return { width: 280, height: 90 + Math.min(d.via.filter((v) => v.group !== 'auto').length, 8) * 26 };
    case 'end': return { width: 200, height: 56 };
    case 'workflow': return { width: 320, height: 260 };
    case 'trigger': return { width: 240, height: 76 };
    case 'form': return { width: 260, height: 110 };
    case 'missing': return { width: 260, height: 70 };
    default: return { width: 400, height: 80 };
  }
}

/**
 * The nodes in the order things happen (breadth-first from `roots`, or from nodes nothing leads to): ELK keeps the
 * model order when it breaks cycles (back buttons, retries), so the first screen stays on the left.
 */
function inFlowOrder(nodes: MapNode[], edges: MapEdge[], roots: string[] = []) {
  const ids = new Set(nodes.map((n) => n.id));
  const inner = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const starts = roots.length ? roots : nodes.filter((n) => !inner.some((e) => e.target === n.id)).map((n) => n.id);
  const depth = new Map<string, number>();
  const queue = starts.filter((id) => ids.has(id) || roots.includes(id)).map((id) => ({ id, d: 0 }));
  while (queue.length) {
    const { id, d } = queue.shift()!;
    if (depth.has(id)) continue;
    depth.set(id, d);
    for (const e of edges) if (e.source === id && (ids.has(e.target)) && !depth.has(e.target)) queue.push({ id: e.target, d: d + 1 });
  }
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  return [...nodes].sort((a, b) => (depth.get(a.id) ?? 999) - (depth.get(b.id) ?? 999) || index.get(a.id)! - index.get(b.id)!);
}

const elk = new ELK();

async function elkLayout(nodes: MapNode[], edges: MapEdge[], size: (n: MapNode) => { width: number; height: number }, options: Record<string, string> = {}) {
  const ids = new Set(nodes.map((n) => n.id));
  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.layered.spacing.nodeNodeBetweenLayers': '140', 'elk.spacing.nodeNode': '70',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF', 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Back buttons and retries loop back: keep the authored order (first screen on the left).
      'elk.layered.cycleBreaking.strategy': 'MODEL_ORDER', ...options,
    },
    children: nodes.map((n) => ({ id: n.id, ...size(n) })),
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target).map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  return new Map((graph.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? 0, height: c.height ?? 0 }]));
}

/** Positions of every node: app on top, one row per journey, automations below. */
export async function layoutMap(nodes: MapNode[], edges: MapEdge[], measured: Record<string, { width: number; height: number }>) {
  const size = (n: MapNode) => measured[n.id] ?? estimate(n);
  const positions = new Map<string, { x: number; y: number }>();
  const of = (kind: MapNodeData['kind']) => nodes.filter((n) => n.data.kind === kind);

  // App: the layout, then the pages side by side.
  const left = 0;
  positions.set('region:app', { x: left, y: -170 });
  positions.set('layout', { x: left, y: 0 });
  let x = left + size(nodes.find((n) => n.id === 'layout')!).width + 300;
  let pagesBottom = size(nodes.find((n) => n.id === 'layout')!).height;
  for (const page of of('page')) {
    positions.set(page.id, { x, y: 0 });
    x += size(page).width + 180;
    pagesBottom = Math.max(pagesBottom, size(page).height);
  }

  // Journeys: a layered layout per journey, rows stacked.
  let y = pagesBottom + 520;
  positions.set('region:journeys', { x: left, y: y - 170 });
  for (const journey of of('journey')) {
    const key = (journey.data as Extract<MapNodeData, { kind: 'journey' }>).journeyKey;
    const prefix = `j:${key}:`;
    const row = nodes.filter((n) => n.id === journey.id || n.id.startsWith(prefix));
    // The journey card on the left, its touchpoints laid out to the right of it.
    const rest = inFlowOrder(row.filter((n) => n.id !== journey.id), edges, [journey.id]);
    const laid = await elkLayout(rest, edges, size);
    const boxes = [...laid.values()];
    const minX = Math.min(...boxes.map((b) => b.x), 0);
    const minY = Math.min(...boxes.map((b) => b.y), 0);
    const journeyWidth = size(journey).width;
    const startX = left + journeyWidth + 160;
    let rowBottom = size(journey).height;
    positions.set(journey.id, { x: left, y });
    for (const n of rest) {
      const p = laid.get(n.id);
      if (!p) continue;
      positions.set(n.id, { x: startX + p.x - minX, y: y + p.y - minY });
      rowBottom = Math.max(rowBottom, p.y - minY + p.height);
    }
    // The workflow that runs it, under the journey card.
    const workflowId = (journey.data as Extract<MapNodeData, { kind: 'journey' }>).workflowId;
    const below = workflowId ? nodes.find((n) => n.id === `wf:${workflowId}`) : nodes.find((n) => n.id === `missing:${key}`);
    if (below && !positions.has(below.id)) {
      positions.set(below.id, { x: left, y: y + size(journey).height + 90 });
      rowBottom = Math.max(rowBottom, size(journey).height + 90 + size(below).height);
    }
    y += Math.max(rowBottom, 200) + 300;
  }

  // Automations: triggers → workflows → functions, forms.
  const placed = new Set(positions.keys());
  const automation = inFlowOrder(nodes.filter((n) => !placed.has(n.id) && ['workflow', 'trigger', 'form', 'missing'].includes(n.data.kind)), edges);
  if (automation.length) {
    y += 200;
    positions.set('region:automations', { x: left, y: y - 170 });
    const laid = await elkLayout(automation, edges, size, { 'elk.layered.spacing.nodeNodeBetweenLayers': '160', 'elk.spacing.nodeNode': '50' });
    const boxes = [...laid.values()];
    const minX = Math.min(...boxes.map((b) => b.x), 0);
    const minY = Math.min(...boxes.map((b) => b.y), 0);
    for (const n of automation) {
      const p = laid.get(n.id);
      if (p) positions.set(n.id, { x: left + p.x - minX, y: y + p.y - minY });
    }
  }
  return positions;
}
