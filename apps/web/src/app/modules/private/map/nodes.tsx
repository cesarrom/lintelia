import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Handle, Position, useStore, useStoreApi, useUpdateNodeInternals, type NodeProps } from 'reactflow';
import {
  AlertTriangle, ArrowUpRight, BellRing, Check, CircleCheck, CircleSlash, ClipboardList, CloudCog, Cog, ExternalLink, EyeOff, FileInput, FileSignature, Home, Link2Off,
  ListChecks, MessageSquareMore, PenLine, Plug, Radio, Route, ScanLine, SquareFunction, Timer, Upload, UserRound, Users, Workflow, XCircle, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Monogram } from '@/components/brand/Monogram';
import { cn } from '@/lib/utils';
import { AppIcon } from '@/client-app/icons';
import { AppPageView, appThemeProps, pageScope } from '@/client-app/runtime';
import { RichText } from '@/client-app/widgets/shared';
import { targetOf, useMap } from './context';
import { PAGE_WIDTH, SCREEN_WIDTH, type MapNodeData } from './graph';
import type { MapTouchpoint, MapViaStep } from './types';

type Data<K extends MapNodeData['kind']> = Extract<MapNodeData, { kind: K }>;

const HANDLE = '!h-2.5 !w-2.5 !border-2 !border-background';
const EDGE_COLOR: Record<string, string> = {
  nav: '#94a3b8', link: '#6366f1', journey: '#8b5cf6', flow: '#0ea5e9', runs: '#f59e0b', call: '#14b8a6', trigger: '#ec4899', form: '#10b981', notify: '#a1a1aa', done: '#a1a1aa',
};
export const edgeColor = (kind: string) => EDGE_COLOR[kind] ?? '#94a3b8';

/** Zoom of the canvas (labels keep a readable size when zoomed out, like frame names in a design tool). */
const useZoom = () => useStore((s) => s.transform[2]);

/**
 * Vertical positions (in the node's own coordinates) of elements inside a node, for handles that sit next to what they
 * belong to: a widget of a page, a button of a screen. Measured after render and whenever the content resizes.
 */
function useAnchors(nodeId: string, root: RefObject<HTMLElement | null>, selectors: Record<string, string>, deps: unknown[]) {
  const [tops, setTops] = useState<Record<string, number>>({});
  const store = useStoreApi();
  const update = useUpdateNodeInternals();
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const zoom = store.getState().transform[2] || 1;
      const base = element.getBoundingClientRect();
      const next: Record<string, number> = {};
      for (const [id, selector] of Object.entries(selectors)) {
        const target = element.querySelector(selector);
        if (!target) continue;
        const rect = target.getBoundingClientRect();
        next[id] = Math.round((rect.top + Math.min(rect.height / 2, 28) - base.top) / zoom);
      }
      setTops((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const late = [setTimeout(measure, 400), setTimeout(measure, 1500)];
    return () => {
      observer.disconnect();
      late.forEach(clearTimeout);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => update(nodeId), [tops, nodeId, update]);
  return tops;
}

/** A frame's name above it (drag it to move the frame), readable at any zoom. */
function FrameLabel({ icon, title, meta, children }: { icon: ReactNode; title: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  const zoom = useZoom();
  const scale = zoom < 0.6 ? Math.min(0.6 / zoom, 3.2) : 1;
  return (
    <div className="map-drag absolute bottom-full left-0 mb-1.5 flex origin-bottom-left cursor-grab items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-muted-foreground active:cursor-grabbing" style={{ transform: `scale(${scale})` }}>
      <span className="text-foreground/70">{icon}</span>
      <span className="text-foreground">{title}</span>
      {meta}
      {children}
    </div>
  );
}

const Chip = ({ children, tone = 'muted', title }: { children: ReactNode; tone?: 'muted' | 'warn' | 'brand' | 'ok' | 'danger'; title?: string }) => (
  <span title={title} className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-medium', {
    muted: 'bg-muted text-muted-foreground', warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', brand: 'bg-primary/10 text-primary',
    ok: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300', danger: 'bg-red-500/12 text-red-700 dark:text-red-300',
  }[tone])}>{children}</span>
);

function Selectable({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { selected, focus } = useMap();
  const dim = !!focus && !focus.nodes.has(id);
  return (
    <div className={cn('relative transition-opacity duration-200', dim && 'opacity-25', className)} data-map-node={id} data-selected={selected === id || undefined}>
      {children}
    </div>
  );
}

// --- regions ---------------------------------------------------------------------------------------------------------------

export const RegionNode = memo(({ data }: NodeProps<Data<'region'>>) => {
  const zoom = useZoom();
  const scale = zoom < 0.5 ? Math.min(0.5 / zoom, 5) : 1;
  return (
    <div className="pointer-events-none origin-bottom-left select-none" style={{ transform: `scale(${scale})` }}>
      <p className="text-[32px] font-semibold tracking-[-0.03em] text-foreground/85">{data.title}</p>
      {data.subtitle && <p className="text-[15px] text-muted-foreground">{data.subtitle}</p>}
    </div>
  );
});

// --- the app's layout: the shell shared by every page, its navigation once ------------------------------------------------

export const LayoutNode = memo(({ id }: NodeProps<Data<'layout'>>) => {
  const { definition, institution, appData, selected } = useMap();
  const root = useRef<HTMLDivElement>(null);
  const brand = definition.theme?.header === 'brand';
  const anchors = useAnchors(id, root, Object.fromEntries(definition.navigation.map((_, i) => [`n:${i}`, `[data-nav-index="${i}"]`])), [definition.navigation]);
  const segments = appData?.me.segments ?? [];
  return (
    <Selectable id={id}>
      <FrameLabel icon={<Route className="h-3.5 w-3.5" />} title="Layout" meta={<span>· shared by every page</span>} />
      <div ref={root} className={cn('w-[280px] overflow-hidden rounded-xl border bg-card shadow-raised ring-offset-4 ring-offset-canvas', selected === id && 'ring-2 ring-primary')} {...appThemeProps(definition, institution)}>
        <div className={cn('flex items-center gap-2.5 border-b px-4 py-3.5', brand ? 'bg-primary text-primary-foreground' : '')}>
          <Monogram name={institution.name} size="sm" />
          <span className="truncate text-[14px] font-semibold">{institution.name}</span>
        </div>
        <nav className="space-y-1 p-2.5">
          {definition.navigation.map((item, i) => {
            const hidden = !!item.visibleIf?.trim() && !ruleMentions(item.visibleIf, segments);
            return (
              <div key={i} data-nav-index={i} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium', item.page === definition.home ? 'bg-primary-soft text-primary' : 'text-foreground/75', hidden && 'opacity-45')}>
                <AppIcon name={item.icon} fallback="circle" className="h-4 w-4" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.visibleIf && <span title={`Shown when: ${item.visibleIf}`}><EyeOff className={cn('h-3 w-3', hidden ? 'text-amber-600' : 'text-muted-foreground/50')} /></span>}
              </div>
            );
          })}
          {!definition.navigation.length && <p className="px-2.5 py-2 text-xs text-muted-foreground">No menu yet.</p>}
        </nav>
        <div className="space-y-1.5 border-t px-4 py-3 text-[11.5px] text-muted-foreground">
          <p><span className="font-medium text-foreground/70">Sign-up</span> · {definition.registration?.enabled ? (definition.registration.methods ?? []).join(', ').replace('email_code', 'e-mailed code') : 'off'}</p>
          {!!definition.registration?.consents?.length && <p><span className="font-medium text-foreground/70">Consents</span> · {definition.registration.consents.map((c) => c.label).join(', ')}</p>}
          <p><span className="font-medium text-foreground/70">Theme</span> · {definition.theme?.header === 'brand' ? 'brand header' : 'light header'}, {definition.theme?.radius ?? 'default'} corners</p>
        </div>
      </div>
      {definition.navigation.map((_, i) => (
        <Handle key={i} type="source" position={Position.Right} id={`n:${i}`} isConnectable={false} className={HANDLE} style={{ top: anchors[`n:${i}`] ?? 80 + i * 36, background: edgeColor('nav') }} />
      ))}
    </Selectable>
  );
});

/** Whether a `visibleIf` rule talking about segments would hold for these segments (a simple reading for the map). */
function ruleMentions(rule: string, segments: string[]) {
  const positive = [...rule.matchAll(/(?<!\$not\()'([a-z0-9_-]+)'\s+in\s+(?:me\.)?segments/gi)].map((m) => m[1]);
  const negative = [...rule.matchAll(/\$not\(\s*'([a-z0-9_-]+)'\s+in\s+(?:me\.)?segments\s*\)/gi)].map((m) => m[1]);
  if (!positive.length && !negative.length) return true;
  return positive.every((s) => segments.includes(s)) && negative.every((s) => !segments.includes(s));
}

// --- pages: the real widgets, rendered with the sample client ------------------------------------------------------------

export const PageNode = memo(({ id, data }: NodeProps<Data<'page'>>) => {
  const { definition, appData, selected, open } = useMap();
  const page = definition.pages[data.pageKey];
  const root = useRef<HTMLDivElement>(null);
  const widgetIds = [...new Set(data.links.map((l) => l.widgetId))];
  const anchors = useAnchors(id, root, Object.fromEntries(widgetIds.map((w) => [`w:${w}`, `[data-widget-id="${w}"]`])), [appData, page, widgetIds.join()]);
  if (!page) return null;
  return (
    <Selectable id={id}>
      <FrameLabel
        icon={data.home ? <Home className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
        title={page.title.startsWith('=') ? data.pageKey : page.title}
        meta={<>
          <span className="font-mono text-[11px] text-muted-foreground/70">/{data.pageKey}</span>
          {data.home && <Chip tone="brand">home</Chip>}
          {page.visibleIf && <Chip tone="warn" title={page.visibleIf}>conditional</Chip>}
          {data.orphan && <Chip tone="danger"><Link2Off className="h-3 w-3" />nothing leads here</Chip>}
        </>}
      >
        <button type="button" className="nodrag ml-1 rounded px-1 text-[11px] text-primary hover:underline" onClick={() => open(id)}>Edit</button>
      </FrameLabel>
      <div
        ref={root}
        className={cn('overflow-hidden rounded-xl border bg-canvas shadow-raised ring-offset-4 ring-offset-canvas transition-shadow', selected === id && 'ring-2 ring-primary')}
        style={{ width: PAGE_WIDTH }}
      >
        <div className="nodrag pointer-events-auto relative overflow-hidden px-7 py-7" style={{ maxHeight: PAGE_MAX_HEIGHT }} onDoubleClick={() => open(id)}>
          {appData ? <AppPageView page={page} scope={pageScope(appData, {})} /> : <div className="h-96 animate-pulse rounded-2xl bg-muted" />}
          <CutOff root={root} />
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} className={HANDLE} style={{ top: 40, background: edgeColor('link') }} />
      {widgetIds.map((w) => (
        <Handle key={w} type="source" position={Position.Right} id={`w:${w}`} isConnectable={false} className={HANDLE} style={{ top: Math.min(anchors[`w:${w}`] ?? 60, PAGE_MAX_HEIGHT - 16), background: edgeColor('link') }} />
      ))}
    </Selectable>
  );
});

/** Long pages (a year of transactions) are cut, like a frame in a design file: the rest scrolls in the app. */
const PAGE_MAX_HEIGHT = 1900;
function CutOff({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const [cut, setCut] = useState(false);
  useEffect(() => {
    const element = root.current?.firstElementChild as HTMLElement | null;
    if (!element) return;
    const check = () => setCut(element.scrollHeight > PAGE_MAX_HEIGHT + 4);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element.firstElementChild ?? element);
    return () => observer.disconnect();
  }, [root]);
  if (!cut) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-40 items-end justify-center bg-gradient-to-t from-canvas via-canvas/85 to-transparent pb-4">
      <span className="rounded-full border bg-background px-3 py-1 text-[12px] text-muted-foreground shadow-sm">The page continues (scrolls in the app)</span>
    </div>
  );
}

// --- journeys -------------------------------------------------------------------------------------------------------------

export const JourneyNode = memo(({ id, data }: NodeProps<Data<'journey'>>) => {
  const { definition, selected, follow } = useMap();
  const journey = definition.journeys?.[data.journeyKey];
  if (!journey) return null;
  return (
    <Selectable id={id}>
      <FrameLabel icon={<Route className="h-3.5 w-3.5" />} title="Journey" meta={<span className="font-mono text-[11px]">{data.journeyKey}</span>} />
      <div className={cn('w-[300px] rounded-2xl border-2 border-violet-500/40 bg-card p-4 shadow-raised', selected === id && 'ring-2 ring-primary ring-offset-4 ring-offset-canvas')}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><AppIcon name={journey.icon} fallback="sparkles" className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{journey.title}</p>
            {journey.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{journey.description}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {journey.category && <Chip>{journey.category}</Chip>}
          {journey.hidden && <Chip tone="warn">started by buttons only</Chip>}
          {journey.eligibility && <Chip tone="brand" title={journey.eligibility}>who: {journey.eligibility.length > 34 ? `${journey.eligibility.slice(0, 34)}…` : journey.eligibility}</Chip>}
          {!!journey.inputs?.length && <Chip>inputs: {journey.inputs.join(', ')}</Chip>}
          {!data.reachable && <Chip tone="danger"><Link2Off className="h-3 w-3" />no button starts it</Chip>}
        </div>
        {!!journey.stages?.length && (
          <ol className="mt-3 flex flex-wrap items-center gap-1 text-[10.5px] text-muted-foreground">
            {journey.stages.map((s, i) => <li key={s.key} className="flex items-center gap-1">{i > 0 && <span className="text-muted-foreground/40">›</span>}{s.label}</li>)}
          </ol>
        )}
        {journey.donePage && (
          <button type="button" className="nodrag mt-3 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary" onClick={() => follow(`page:${journey.donePage}`)}>
            When done → <span className="font-medium">{definition.pages[journey.donePage]?.title ?? journey.donePage}</span>
          </button>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} className={HANDLE} style={{ top: 40, background: edgeColor('journey') }} />
      <Handle type="source" position={Position.Right} id="start" isConnectable={false} className={HANDLE} style={{ top: 40, background: edgeColor('flow') }} />
      <Handle type="source" position={Position.Right} id="done" isConnectable={false} className={HANDLE} style={{ top: 'auto', bottom: 18, background: edgeColor('done') }} />
      <Handle type="source" position={Position.Bottom} id="runs" isConnectable={false} className={HANDLE} style={{ background: edgeColor('runs') }} />
    </Selectable>
  );
});

const TOUCHPOINT_META: Record<MapTouchpoint['kind'], { label: string; icon: typeof Route }> = {
  screen: { label: 'Screen', icon: ListChecks },
  request: { label: 'Request', icon: MessageSquareMore },
  form: { label: 'Form', icon: ClipboardList },
  action: { label: 'Vendor page', icon: FileSignature },
  parties: { label: 'Related parties', icon: Users },
};

/** A touchpoint drawn like the client sees it (a screen of the journey, a request card, a vendor step). */
export const TouchpointNode = memo(({ id, data }: NodeProps<Data<'touchpoint'>>) => {
  const { selected, edges, follow, open } = useMap();
  const tp = data.touchpoint;
  const root = useRef<HTMLDivElement>(null);
  const anchors = useAnchors(id, root, Object.fromEntries(tp.events.map((e) => [`e:${e.key}`, `[data-map-event="${e.key}"]`])), [tp]);
  const meta = TOUCHPOINT_META[tp.kind];
  const go = (event: string) => {
    const target = targetOf(edges, id, `e:${event}`);
    if (target) follow(target);
  };
  return (
    <Selectable id={id}>
      <FrameLabel
        icon={<meta.icon className="h-3.5 w-3.5" />} title={tp.name}
        meta={<>
          <Chip>{meta.label}</Chip>
          {tp.stage && <Chip tone="brand">stage: {tp.stage}</Chip>}
          {data.first && <Chip tone="ok">first</Chip>}
        </>}
      >
        <button type="button" className="nodrag ml-1 rounded px-1 text-[11px] text-primary hover:underline" onClick={() => open(id, { step: tp.stepId })}>Edit</button>
      </FrameLabel>
      <div ref={root} className={cn('overflow-hidden rounded-xl border bg-canvas shadow-raised', selected === id && 'ring-2 ring-primary ring-offset-4 ring-offset-canvas')} style={{ width: SCREEN_WIDTH }}>
        <div className="nodrag p-5" onDoubleClick={() => open(id, { step: tp.stepId })}>
          {tp.kind === 'screen' ? <StaticScreen tp={tp} onButton={go} /> : <StaticRequest tp={tp} onEvent={go} />}
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} className={HANDLE} style={{ top: 40, background: edgeColor('flow') }} />
      {tp.events.map((e) => (
        <Handle key={e.key} type="source" position={Position.Right} id={`e:${e.key}`} isConnectable={false} className={HANDLE} style={{ top: anchors[`e:${e.key}`] ?? 60, background: edgeColor('flow') }} />
      ))}
    </Selectable>
  );
});

/** A journey screen as the client sees it: fields (with their bindings) and buttons; a button follows its arrow. */
function StaticScreen({ tp, onButton }: { tp: MapTouchpoint; onButton: (event: string) => void }) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
      <div>
        <p className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">{tp.title}</p>
        {tp.description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{tp.description}</p>}
      </div>
      {tp.content && <div className="rounded-xl border bg-muted/25 p-3"><RichText text={tp.content} className="text-[13px]" /></div>}
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      {tp.fields.map((f) => (
        <div key={f.key} className={cn('space-y-1', f.width === 'half' ? 'col-span-1' : 'col-span-2', f.visibleIf && 'rounded-lg border border-dashed border-primary/30 p-2')} data-map-field={f.key}>
          {f.visibleIf && <p className="flex items-center gap-1 text-[10.5px] text-primary"><EyeOff className="h-3 w-3" />shown when <span className="truncate font-mono">{f.visibleIf}</span></p>}
          {f.type !== 'checkbox' && f.type !== 'display' && (
            <p className="text-[12.5px] font-medium">{f.label}{!f.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</p>
          )}
          {f.type === 'display' ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/25 px-3 py-2 text-[12.5px]"><span className="text-muted-foreground">{f.label}</span><Chip tone="brand">calculated</Chip></div>
          ) : f.type === 'scan' ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-[12px]"><ScanLine className="h-4 w-4 text-primary" />Scan with the camera, a photo, or type the code</div>
          ) : f.type === 'signature' ? (
            <div className="flex h-16 items-end gap-2 rounded-lg border border-dashed px-3 pb-2 text-[12px] text-muted-foreground"><PenLine className="h-3.5 w-3.5" />Sign here</div>
          ) : f.type === 'otp' ? (
            <div className="flex gap-1.5">{Array.from({ length: 6 }, (_, i) => <span key={i} className="h-8 w-7 rounded-md border bg-background" />)}</div>
          ) : f.type === 'slider' ? (
            <div className="relative h-1.5 rounded-full bg-muted"><span className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary" /><span style={{ left: "40%" }} className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" /></div>
          ) : f.type === 'checkbox' ? (
            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5 text-[12.5px]"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border" />{f.label}</div>
          ) : f.type === 'file' ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-[12px] text-muted-foreground"><Upload className="h-3.5 w-3.5" />Upload (PDF, photo)</div>
          ) : f.type === 'choice' ? (
            <div className="grid grid-cols-2 gap-1.5">{(f.options ?? []).slice(0, 4).map((o) => <div key={o.value} className="truncate rounded-lg border px-2.5 py-2 text-[12px]">{o.label}</div>)}</div>
          ) : (
            <div className={cn('flex h-9 items-center justify-between gap-2 rounded-md border bg-background px-3 text-[12.5px]', f.type === 'textarea' && 'h-16 items-start pt-2')}>
              <span className={cn('truncate', !f.default && 'text-muted-foreground/70')}>
                {f.default ?? (f.type === 'select' ? (f.optionsFrom ? `One of the client's ${f.optionsFrom}` : `${f.options?.length ?? 0} options`) : f.placeholder ?? (f.type === 'money' ? '0.00' : ''))}
              </span>
              {f.default?.includes('{{') || f.default?.startsWith('=') ? <Chip tone="brand">prefilled</Chip> : f.type !== 'text' ? <span className="text-[10.5px] text-muted-foreground/70">{f.type}</span> : null}
            </div>
          )}
          {f.help && <p className="text-[11.5px] text-muted-foreground">{f.help}</p>}
        </div>
      ))}
      </div>
      {tp.autoSubmit && (
        <p className="flex items-center gap-1.5 rounded-lg bg-primary-soft px-2.5 py-1.5 text-[11.5px] text-primary" data-map-auto={tp.autoSubmit.button}>
          <Timer className="h-3.5 w-3.5" />Continues by itself ({tp.autoSubmit.button}) {tp.autoSubmit.when === 'expression' ? 'when its rule holds' : 'once complete'}{tp.autoSubmit.delay ? ` after ${tp.autoSubmit.delay} s` : ''}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        {tp.buttons.map((b) => (
          <Button key={b.key} type="button" size="sm" variant={b.style === 'secondary' ? 'outline' : b.style === 'danger' ? 'destructive' : 'default'} onClick={() => onButton(b.key)} data-map-event={b.key}>
            {b.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A request, a form or a vendor step, as the request card the client gets. */
function StaticRequest({ tp, onEvent }: { tp: MapTouchpoint; onEvent: (event: string) => void }) {
  const Icon = tp.kind === 'action' ? FileSignature : tp.kind === 'form' ? ClipboardList : tp.kind === 'parties' ? Users : tp.items.some((i) => i.type === 'file') ? Upload : MessageSquareMore;
  return (
    <div className="space-y-3 rounded-2xl border border-warning/40 bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-[hsl(30_85%_38%)]"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{tp.title}</p>
          <p className="text-[11px] text-muted-foreground">Waiting for the client</p>
        </div>
      </div>
      {tp.description && <p className="text-[12.5px] leading-relaxed">{tp.description}</p>}
      {tp.items.map((i) => (
        <div key={i.key} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[12px]">{i.type === 'file' ? <Upload className="h-3.5 w-3.5" /> : <MessageSquareMore className="h-3.5 w-3.5" />}{i.label}</div>
      ))}
      {tp.connector && <div className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"><ExternalLink className="h-3.5 w-3.5" />Opens {tp.connector.name}: {tp.connector.component}</div>}
      {tp.kind === 'form' && <div className="rounded-md border px-3 py-2 text-[12px] text-muted-foreground">One of your forms, filled in the portal</div>}
      <div className="space-y-1 border-t pt-3">
        {tp.events.map((e) => (
          <button key={e.key} type="button" data-map-event={e.key} onClick={() => onEvent(e.key)} className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground">
            <span>When {e.label.toLowerCase()}</span><ArrowUpRight className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}

// --- what happens between touchpoints ---------------------------------------------------------------------------------------

const VIA_ICON: Record<MapViaStep['group'], typeof Route> = { people: UserRound, connector: Plug, function: SquareFunction, workflow: Workflow, signal: Radio, notify: BellRing, auto: Cog };

export const ProcessNode = memo(({ id, data }: NodeProps<Data<'process'>>) => {
  const { open, selected } = useMap();
  const shown = data.via.filter((v) => v.group !== 'auto');
  const auto = data.via.length - shown.length;
  return (
    <Selectable id={id}>
      <div className={cn('w-[280px] rounded-2xl border border-dashed border-sky-500/50 bg-sky-500/[0.04] p-3 text-[12px]', selected === id && 'ring-2 ring-primary ring-offset-4 ring-offset-canvas')}>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-sky-700 dark:text-sky-300"><CloudCog className="h-3.5 w-3.5" />Behind the scenes</p>
        <ul className="space-y-1">
          {shown.slice(0, 9).map((v) => {
            const Icon = VIA_ICON[v.group];
            return (
              <li key={v.stepId}>
                <button type="button" className="nodrag flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-background/80" onClick={() => open(`wf:${data.workflowId}`, { step: v.stepId })}>
                  <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', v.group === 'people' ? 'text-violet-600' : v.group === 'connector' ? 'text-indigo-600' : v.group === 'function' ? 'text-teal-600' : 'text-muted-foreground')} />
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="font-medium">{v.name}</span>
                    {v.detail && <span className="text-muted-foreground"> · {v.detail}</span>}
                    {v.asksClient && <span className="block text-[10.5px] text-amber-700 dark:text-amber-300">may ask the client for more</span>}
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length > 9 && <li className="px-1.5 text-muted-foreground">+ {shown.length - 9} more</li>}
        </ul>
        {auto > 0 && <p className="mt-1.5 px-1.5 text-[11px] text-muted-foreground">+ {auto} automatic {auto === 1 ? 'step' : 'steps'} (checks, calculations, updates)</p>}
      </div>
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} className={HANDLE} style={{ background: edgeColor('flow') }} />
      <Handle type="source" position={Position.Right} isConnectable={false} className={HANDLE} style={{ background: edgeColor('flow') }} />
    </Selectable>
  );
});

export const EndNode = memo(({ id, data }: NodeProps<Data<'end'>>) => {
  const { selected } = useMap();
  const ok = ['approved', 'completed'].includes(data.end.status);
  const bad = ['rejected', 'failed'].includes(data.end.status);
  const Icon = ok ? CircleCheck : bad ? XCircle : CircleSlash;
  return (
    <Selectable id={id}>
      <div className={cn('flex w-[200px] items-center gap-2 rounded-full border px-3.5 py-2.5 text-[12.5px] font-medium shadow-sm',
        ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : bad ? 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200' : 'border-border bg-muted text-muted-foreground',
        selected === id && 'ring-2 ring-primary')}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{data.end.label}</span>
        <span className="ml-auto text-[10.5px] font-normal opacity-70">{data.end.status}</span>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={false} className={HANDLE} style={{ background: edgeColor('flow') }} />
    </Selectable>
  );
});

// --- workflows, triggers, forms ------------------------------------------------------------------------------------------

export const WorkflowNode = memo(({ id, data }: NodeProps<Data<'workflow'>>) => {
  const { open, selected } = useMap();
  const w = data.workflow;
  const connectors = [...new Set(w.connectors.map((c) => c.connectorName))];
  const roles = [...new Set(w.people.map((p) => p.role).filter(Boolean))] as string[];
  return (
    <Selectable id={id}>
      <div className={cn('w-[320px] rounded-2xl border bg-card p-4 shadow-raised', w.function ? 'border-teal-500/50' : 'border-amber-500/40', selected === id && 'ring-2 ring-primary ring-offset-4 ring-offset-canvas')}>
        <div className="map-drag flex cursor-grab items-start gap-3 active:cursor-grabbing">
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', w.function ? 'bg-teal-500/12 text-teal-600 dark:text-teal-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300')}>
            {w.function ? <SquareFunction className="h-[18px] w-[18px]" /> : <Workflow className="h-[18px] w-[18px]" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{w.function ? 'Function' : 'Workflow'}</p>
            <p className="font-semibold leading-tight">{w.name}</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          <Chip tone={w.status === 'active' ? 'ok' : 'warn'}>{w.status === 'active' ? <><Check className="h-3 w-3" />v{w.activeVersion}</> : 'draft'}</Chip>
          <Chip>{w.stepCount} steps</Chip>
          {!!w.touchpoints.length && <Chip tone="brand">{w.touchpoints.length} client touchpoints</Chip>}
          {w.clientVisibility === 'requests_only' && <Chip>back office only</Chip>}
          {w.error && <Chip tone="danger"><AlertTriangle className="h-3 w-3" />invalid YAML</Chip>}
        </div>
        <dl className="mt-3 space-y-1.5 text-[11.5px]">
          {!!w.stages.length && <Row label="Stages">{w.stages.filter((s) => !s.exit).map((s) => s.label).join(' › ')}</Row>}
          {!!roles.length && <Row label="People">{roles.map((r) => r.replace(/_/g, ' ')).join(', ')}</Row>}
          {!!connectors.length && <Row label="Systems">{connectors.join(', ')}</Row>}
          {!!w.signals.length && <Row label="Waits for">{w.signals.map((s) => s.signal).join(', ')}</Row>}
          {w.function && !!w.inputs.length && <Row label="In → out">{w.inputs.map((i) => i.name).join(', ')} → {w.outputs.join(', ') || '—'}</Row>}
        </dl>
        <Button size="sm" variant="outline" className="nodrag mt-3 h-7 w-full text-xs" onClick={() => open(id)}><ArrowUpRight className="h-3.5 w-3.5" />Open in the workflow editor</Button>
      </div>
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} className={HANDLE} style={{ top: 30, background: edgeColor('call') }} />
      <Handle type="target" position={Position.Top} id="top" isConnectable={false} className={HANDLE} style={{ background: edgeColor('runs') }} />
      <Handle type="source" position={Position.Right} id="out" isConnectable={false} className={HANDLE} style={{ top: 30, background: edgeColor('call') }} />
    </Selectable>
  );
});

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[62px_1fr] gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd></div>
);

export const TriggerNode = memo(({ id, data }: NodeProps<Data<'trigger'>>) => {
  const { selected } = useMap();
  return (
    <Selectable id={id}>
      <div className={cn('flex w-[240px] items-center gap-2.5 rounded-2xl border border-pink-500/40 bg-pink-500/[0.06] px-3.5 py-3', selected === id && 'ring-2 ring-primary')}>
        <Zap className="h-4 w-4 shrink-0 text-pink-600" />
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">When · {data.source}</p>
          <p className="truncate text-[13px] font-semibold capitalize">{data.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} className={HANDLE} style={{ background: edgeColor('trigger') }} />
    </Selectable>
  );
});

export const FormNode = memo(({ id, data }: NodeProps<Data<'form'>>) => {
  const { open, selected } = useMap();
  return (
    <Selectable id={id}>
      <div className={cn('w-[260px] rounded-2xl border border-emerald-500/40 bg-card p-3.5 shadow-sm', selected === id && 'ring-2 ring-primary')}>
        <div className="flex items-start gap-2.5">
          <FileInput className="mt-0.5 h-4 w-4 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Form</p>
            <p className="font-semibold leading-tight">{data.form.name}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">{data.form.published ? <Chip tone="ok">embedded on your site</Chip> : <Chip>not published</Chip>}</div>
        <button type="button" className="nodrag mt-2 text-[11.5px] text-primary hover:underline" onClick={() => open(id)}>Open the form editor</button>
      </div>
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} className={HANDLE} style={{ background: edgeColor('form') }} />
      <Handle type="source" position={Position.Right} id="out" isConnectable={false} className={HANDLE} style={{ background: edgeColor('form') }} />
    </Selectable>
  );
});

export const MissingNode = memo(({ data }: NodeProps<Data<'missing'>>) => (
  <div className="flex w-[260px] items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-[12.5px] text-red-800 dark:text-red-200">
    <AlertTriangle className="h-4 w-4" />{data.label}
    <Handle type="target" position={Position.Top} id="top" isConnectable={false} className={HANDLE} />
  </div>
));

export const NODE_TYPES = {
  region: RegionNode, layout: LayoutNode, page: PageNode, journey: JourneyNode, touchpoint: TouchpointNode, process: ProcessNode, end: EndNode,
  workflow: WorkflowNode, trigger: TriggerNode, form: FormNode, missing: MissingNode,
};
