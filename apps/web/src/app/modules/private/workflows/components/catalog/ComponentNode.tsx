import { useSearchParams } from 'react-router';
import { useMemo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { componentEvents, type NodeData } from '@repo/fintivio/schemas';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { categoryStyle, iconFor, renderSummary, useCatalog } from './catalog';
import { ComponentConfigDialog } from './ComponentConfigDialog';

const KIND_BADGES: Record<string, string> = { human: 'Human task', client: 'Client', timer: 'Timer', container: 'Container' };

/**
 * Generic node for every catalogue component (docs/plans/01): icon, step name, component title, a one-line summary
 * of the configuration and one output handle per event (derived from the config, e.g. review outcomes).
 */
export function ComponentNode({ id, data, selected }: NodeProps<NodeData>) {
  const catalog = useCatalog();
  const definition = catalog.get(data.type);
  // Opened from the experience map on this step (`?step=`): its configuration opens at once.
  const [search] = useSearchParams();
  const [open, setOpen] = useState(() => search.get('step') === data.id);
  const events = useMemo(() => {
    const declared = definition ? componentEvents(definition, data.config as Record<string, unknown>) : [];
    const existing = data.events.map((e) => e.name);
    return [...new Set([...declared, ...existing])];
  }, [definition, data.config, data.events]);

  if (!definition) return <UnknownNode id={id} data={data} selected={selected} />;

  const Icon = iconFor(definition.icon);
  const summary = renderSummary(definition.summary, data.config as Record<string, unknown>);
  const isStart = data.type === 'start';

  const style = categoryStyle(isStart ? 'data' : definition.category);
  const authority = (data.config as { authority?: string } | undefined)?.authority;
  const handle = '!h-3 !w-3 !rounded-full !border-2 !border-card !bg-muted-foreground/70 transition-colors hover:!bg-primary';

  return (
    <>
      <div
        data-testid="workflow-node"
        data-node-type={data.type}
        data-node-id={id}
        className={cn(
          'group relative w-[280px] rounded-xl border bg-card text-card-foreground shadow-raised transition-[box-shadow,border-color]',
          selected ? 'border-primary/60 ring-4 ring-primary/15' : 'hover:border-foreground/20',
        )}
        onDoubleClick={() => !isStart && setOpen(true)}
      >
        <span aria-hidden="true" className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r-full', style.accent)} />
        <div className="flex items-start justify-between gap-2 p-3 pl-3.5 pr-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.tile)}><Icon className="h-4 w-4" /></div>
            <div className="min-w-0 pt-px">
              <p className="truncate text-[13px] font-semibold leading-tight" data-testid="node-name">{data.name}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{definition.title}{definition.source.kind === 'connector' ? ` · ${definition.source.installationName ?? definition.source.connectorId}` : ''}</p>
            </div>
          </div>
          {!isStart && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100" aria-label={`Configure ${data.name}`} onClick={() => setOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {(summary || KIND_BADGES[definition.kind]) && (
          <div className="space-y-1.5 border-t border-dashed px-3.5 py-2.5">
            <div className="flex flex-wrap gap-1">
              {KIND_BADGES[definition.kind] && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{KIND_BADGES[definition.kind]}</span>}
              {authority === 'high' && <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">High authority</span>}
              {typeof authority === 'string' && authority.trim().startsWith('=') && <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Authority by rule</span>}
            </div>
            {summary && <p className="break-words text-[11.5px] leading-relaxed text-muted-foreground" data-testid="node-summary">{summary}</p>}
          </div>
        )}
        {!isStart && <Handle type="target" position={Position.Left} id={`${id}-input`} className={handle} />}
        {events.length > 0 && (
          <div className="border-t bg-muted/30 py-1.5">
            {events.map((event) => (
              <div key={event} className="relative flex h-6 items-center justify-end pr-3.5" data-testid="node-event">
                <span className="rounded-md px-1.5 font-mono text-[10.5px] text-muted-foreground">{event}</span>
                <Handle type="source" position={Position.Right} id={`${id}-${event}`} className={handle} />
              </div>
            ))}
          </div>
        )}
      </div>
      {open && <ComponentConfigDialog nodeId={id} definition={definition} open={open} onOpenChange={setOpen} />}
    </>
  );
}

/** A step whose component is not available here (unknown type, uninstalled connector): visible, never an empty box. */
export function UnknownNode({ id, data, selected }: Pick<NodeProps<NodeData>, 'id' | 'data' | 'selected'>) {
  return (
    <Card data-testid="workflow-node" data-node-type={data.type} data-unknown="true"
      className={cn('w-[300px] border-2 border-dashed border-amber-400 bg-amber-50 p-3 shadow-md dark:bg-amber-950', selected && 'ring-2 ring-ring')}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold">{data.name}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Unknown component <code>{data.type}</code> — not available to this workspace.</p>
      <Handle type="target" position={Position.Left} id={`${id}-input`} />
      {data.events.map((event, index) => (
        <div key={event.name} className="absolute right-0 flex items-center" style={{ top: `${30 + index * 20}%` }}>
          <span className="mr-2 text-[10px] text-muted-foreground">{event.name}</span>
          <Handle type="source" position={Position.Right} id={`${id}-${event.name}`} />
        </div>
      ))}
    </Card>
  );
}
