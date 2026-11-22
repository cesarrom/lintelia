import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps } from 'reactflow';
import { cn } from '@/lib/utils';
import { useMap } from './context';
import type { MapEdgeData } from './graph';
import { edgeColor } from './nodes';

/**
 * An arrow of the map, coloured by what it means (navigation, link, journey, flow, call, trigger…). Around a selection
 * the other arrows fade; labels show when zoomed in enough or when the arrow is in focus.
 */
export const MapEdge = memo(({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps<MapEdgeData>) => {
  const { focus } = useMap();
  const zoom = useStore((s) => s.transform[2]);
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.3 });
  const kind = data?.kind ?? 'link';
  const inFocus = !focus || focus.edges.has(id);
  const emphasised = !!focus && focus.edges.has(id);
  const dashed = kind === 'notify' || kind === 'done' || kind === 'nav';
  const showLabel = !!data?.label && inFocus && (emphasised || zoom > 0.42);
  // Long arrows between regions stay in the background until something around them is in focus.
  const resting = ['link', 'journey', 'nav', 'notify', 'done'].includes(kind) ? 0.45 : 0.9;
  return (
    <>
      <BaseEdge
        id={id} path={path} markerEnd={markerEnd}
        style={{ stroke: edgeColor(kind), strokeWidth: emphasised ? 3 : 1.75, opacity: !focus ? resting : inFocus ? 1 : 0.08, strokeDasharray: dashed ? '6 5' : undefined, transition: 'opacity .2s, stroke-width .2s' }}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className={cn('pointer-events-none absolute max-w-[220px] rounded-md border bg-background/95 px-1.5 py-0.5 text-center text-[11px] leading-tight shadow-sm', emphasised && 'border-primary/40')}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${zoom < 0.7 ? Math.min(0.7 / zoom, 2.2) : 1})`, color: edgeColor(kind) }}
          >
            <span className="font-medium">{data.label}</span>
            {data.sublabel && <span className="block text-[10px] text-muted-foreground">{data.sublabel}</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export const EDGE_TYPES = { map: MapEdge };
