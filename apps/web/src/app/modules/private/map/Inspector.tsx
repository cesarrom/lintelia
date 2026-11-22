import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { humanize } from '@/components/app/page';
import { cn } from '@/lib/utils';
import { useMap } from './context';
import type { MapNode } from './graph';
import { edgeColor } from './nodes';

/** Name of any node, for link lists and search. */
export function nodeTitle(node: MapNode | undefined, definition: ReturnType<typeof useMap>['definition']): string {
  if (!node) return '';
  const d = node.data;
  switch (d.kind) {
    case 'layout': return 'Layout and menu';
    case 'page': { const t = definition.pages[d.pageKey]?.title ?? d.pageKey; return t.startsWith('=') ? d.pageKey : t; }
    case 'journey': return definition.journeys?.[d.journeyKey]?.title ?? d.journeyKey;
    case 'touchpoint': return d.touchpoint.name;
    case 'process': return 'Behind the scenes';
    case 'end': return `Ends: ${d.end.label}`;
    case 'workflow': return d.workflow.name;
    case 'trigger': return `When: ${d.label}`;
    case 'form': return d.form.name;
    case 'region': return d.title;
    case 'missing': return d.label;
  }
}

const KIND_LABEL: Record<string, string> = {
  layout: 'Layout', page: 'Page', journey: 'Journey', touchpoint: 'Touchpoint', process: 'Steps in between', end: 'Outcome', workflow: 'Workflow', trigger: 'Event', form: 'Form', missing: 'Problem',
};

/** The selected node: what it is, where it leads, what leads to it, and its editor. */
export function Inspector({ node, nodes, onClose }: { node: MapNode; nodes: MapNode[]; onClose: () => void }) {
  const { definition, edges, follow, open } = useMap();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);
  const d = node.data;
  const action = (() => {
    switch (d.kind) {
      case 'layout': return { label: 'Edit the menu and settings in the studio', go: () => open(node.id) };
      case 'page': return { label: 'Edit this page in the studio', go: () => open(node.id) };
      case 'journey': return { label: 'Edit this journey in the studio', go: () => open(node.id) };
      case 'touchpoint': return { label: 'Edit this step in the workflow editor', go: () => open(node.id, { step: d.touchpoint.stepId }) };
      case 'process': return { label: 'Open the workflow', go: () => open(`wf:${d.workflowId}`) };
      case 'workflow': return { label: 'Open in the workflow editor', go: () => open(node.id) };
      case 'form': return { label: 'Open the form editor', go: () => open(node.id) };
      default: return null;
    }
  })();

  return (
    <aside className="absolute bottom-3 right-3 top-16 z-10 flex w-[340px] flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-raised backdrop-blur" data-testid="map-inspector" data-node={node.id}>
      <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{KIND_LABEL[d.kind] ?? d.kind}</p>
          <p className="truncate text-[15px] font-semibold" data-testid="map-inspector-title">{nodeTitle(node, definition)}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 text-[13px]">
        <Details node={node} />
        {action && <Button className="w-full" size="sm" onClick={action.go} data-testid="map-open"><ArrowUpRight className="h-4 w-4" />{action.label}</Button>}
        <LinkList title="Leads to" icon={<ArrowUpRight className="h-3.5 w-3.5" />} items={outgoing.map((e) => ({ id: e.id, node: e.target, kind: e.data?.kind ?? '', label: e.data?.label, sub: e.data?.sublabel }))} byId={byId} follow={follow} />
        <LinkList title="Reached from" icon={<ArrowDownLeft className="h-3.5 w-3.5" />} items={incoming.map((e) => ({ id: e.id, node: e.source, kind: e.data?.kind ?? '', label: e.data?.label, sub: e.data?.sublabel }))} byId={byId} follow={follow} />
      </div>
    </aside>
  );
}

function LinkList({ title, icon, items, byId, follow }: {
  title: string; icon: ReactNode; items: Array<{ id: string; node: string; kind: string; label?: string; sub?: string }>; byId: Map<string, MapNode>; follow: (id: string) => void;
}) {
  const { definition } = useMap();
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{icon}{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => follow(item.node)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60" data-testid="map-link">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: edgeColor(item.kind) }} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{nodeTitle(byId.get(item.node), definition)}</span>
                {(item.label || item.sub) && <span className="block truncate text-[11.5px] text-muted-foreground">{[item.label, item.sub].filter(Boolean).join(' · ')}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const Field = ({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) => (
  <div><p className="text-[11px] text-muted-foreground">{label}</p><p className={cn('break-words', mono && 'font-mono text-[12px]')}>{children}</p></div>
);

function Details({ node }: { node: MapNode }) {
  const { definition } = useMap();
  const d = node.data;
  switch (d.kind) {
    case 'page': {
      const page = definition.pages[d.pageKey];
      return (
        <div className="space-y-2.5">
          <Field label="Address" mono>/portal{d.home ? '' : `/p/${d.pageKey}`}</Field>
          {page?.visibleIf && <Field label="Shown when" mono>{page.visibleIf}</Field>}
          <Field label="Widgets">{(page?.widgets ?? []).map((w) => w.type).join(', ') || '—'}</Field>
          {d.orphan && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-800 dark:text-red-200">Nothing leads to this page: add it to the menu or link it from another page.</p>}
        </div>
      );
    }
    case 'journey': {
      const journey = definition.journeys?.[d.journeyKey];
      return (
        <div className="space-y-2.5">
          {journey?.description && <p>{journey.description}</p>}
          <Field label="Who may start it" mono>{journey?.eligibility || 'everyone'}</Field>
          {!!journey?.stages?.length && <Field label="Stages the client sees">{journey.stages.map((s) => s.label).join(' › ')}</Field>}
          {!d.reachable && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-800 dark:text-red-200">No page starts this journey and it is hidden from the launcher.</p>}
        </div>
      );
    }
    case 'touchpoint': {
      const tp = d.touchpoint;
      return (
        <div className="space-y-2.5">
          {tp.stage && <Field label="Stage">{tp.stage}</Field>}
          {!!tp.fields.length && <Field label="Asks for">{tp.fields.map((f) => `${f.label}${f.required ? '' : ' (optional)'}`).join(', ')}</Field>}
          {!!tp.items.length && <Field label="Asks for">{tp.items.map((i) => `${i.label} (${i.type === 'file' ? 'upload' : 'answer'})`).join(', ')}</Field>}
          {tp.connector && <Field label="Vendor">{tp.connector.name}: {tp.connector.component}</Field>}
          <Field label="Step" mono>{tp.stepId}</Field>
        </div>
      );
    }
    case 'process':
      return (
        <ul className="space-y-1.5">
          {d.via.map((v) => <li key={v.stepId} className="flex gap-2"><span className="w-16 shrink-0 text-[11px] text-muted-foreground">{humanize(v.group)}</span><span>{v.name}{v.detail ? <span className="text-muted-foreground"> · {v.detail}</span> : null}</span></li>)}
        </ul>
      );
    case 'workflow': {
      const w = d.workflow;
      return (
        <div className="space-y-2.5">
          {w.description && <p className="text-muted-foreground">{w.description}</p>}
          <Field label="Status">{w.status === 'active' ? `Published, version ${w.activeVersion}` : 'Draft (never published)'}</Field>
          {!!w.startOn.length && <Field label="Starts on" mono>{w.startOn.join(', ')}</Field>}
          {!!w.people.length && <Field label="People">{w.people.map((p) => `${p.name}${p.role ? ` (${p.role.replace(/_/g, ' ')})` : ''}`).join(', ')}</Field>}
          {!!w.connectors.length && <Field label="Systems">{w.connectors.map((c) => `${c.name} (${c.connectorName})`).join(', ')}</Field>}
          {!!w.calls.length && <Field label="Uses">{w.calls.map((c) => c.name).join(', ')}</Field>}
          {w.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-red-800 dark:text-red-200">{w.error}</p>}
        </div>
      );
    }
    case 'trigger':
      return <div className="space-y-2.5"><Field label="Event" mono>{d.event}</Field><Field label="From">{d.source}</Field></div>;
    case 'form':
      return <div className="space-y-2.5">{d.form.description && <p>{d.form.description}</p>}<Field label="Published">{d.form.published ? 'yes, embeddable' : 'no'}</Field></div>;
    case 'end':
      return <div className="space-y-2.5"><Field label="Case status">{d.end.status}</Field>{d.end.outcome && <Field label="Outcome" mono>{d.end.outcome}</Field>}</div>;
    case 'layout':
      return <p className="text-muted-foreground">The shell every page shares: the menu ({definition.navigation.length} entries), the header, sign-up and theme. Each menu entry points to its page.</p>;
    default:
      return null;
  }
}
