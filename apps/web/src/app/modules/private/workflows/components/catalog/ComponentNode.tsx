import { useMemo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AlertTriangle, Settings2 } from 'lucide-react';
import { componentEvents, type NodeData } from '@repo/fintivio/schemas';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { iconFor, renderSummary, useCatalog } from './catalog';
import { ComponentConfigDialog } from './ComponentConfigDialog';

const KIND_BADGES: Record<string, string> = { human: 'Human task', client: 'Client', timer: 'Timer', container: 'Container' };

/**
 * Generic node for every catalogue component (docs/plans/01): icon, step name, component title, a one-line summary
 * of the configuration and one output handle per event (derived from the config, e.g. review outcomes).
 */
export function ComponentNode({ id, data, selected }: NodeProps<NodeData>) {
  const catalog = useCatalog();
  const definition = catalog.get(data.type);
  const [open, setOpen] = useState(false);
  const events = useMemo(() => {
    const declared = definition ? componentEvents(definition, data.config as Record<string, unknown>) : [];
    const existing = data.events.map((e) => e.name);
    return [...new Set([...declared, ...existing])];
  }, [definition, data.config, data.events]);

  if (!definition) return <UnknownNode id={id} data={data} selected={selected} />;

  const Icon = iconFor(definition.icon);
  const summary = renderSummary(definition.summary, data.config as Record<string, unknown>);
  const isStart = data.type === 'start';

  return (
    <>
      <Card
        data-testid="workflow-node"
        data-node-type={data.type}
        data-node-id={id}
        className={cn('w-[300px] border-2 bg-background shadow-md', selected && 'ring-2 ring-ring ring-offset-2')}
        onDoubleClick={() => !isStart && setOpen(true)}
      >
        <div className="flex items-start justify-between gap-2 p-3 pr-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-0.5 rounded-md bg-muted p-1.5"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" data-testid="node-name">{data.name}</p>
              <p className="truncate text-xs text-muted-foreground">{definition.title}{definition.source.kind === 'connector' ? ` · ${definition.source.installationName ?? definition.source.connectorId}` : ''}</p>
            </div>
          </div>
          {!isStart && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`Configure ${data.name}`} onClick={() => setOpen(true)}>
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {(summary || KIND_BADGES[definition.kind]) && (
          <div className="space-y-1 border-t px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {KIND_BADGES[definition.kind] && <Badge variant="secondary" className="text-[10px]">{KIND_BADGES[definition.kind]}</Badge>}
              {(data.config as { authority?: string } | undefined)?.authority === 'high' && <Badge variant="outline" className="border-red-300 text-[10px] text-red-700">High authority</Badge>}
              {typeof (data.config as { authority?: string } | undefined)?.authority === 'string' && (data.config as { authority: string }).authority.trim().startsWith('=') && <Badge variant="outline" className="text-[10px]">Authority by rule</Badge>}
            </div>
            {summary && <p className="break-words text-xs text-muted-foreground" data-testid="node-summary">{summary}</p>}
          </div>
        )}
        {!isStart && <Handle type="target" position={Position.Left} id={`${id}-input`} className="!bg-muted-foreground" />}
        {events.length > 0 && (
          <div className="border-t py-1">
            {events.map((event) => (
              <div key={event} className="relative flex h-5 items-center justify-end pr-3" data-testid="node-event">
                <span className="text-[10px] text-muted-foreground">{event}</span>
                <Handle type="source" position={Position.Right} id={`${id}-${event}`} className="!bg-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </Card>
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
