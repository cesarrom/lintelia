import { createContext, useContext } from 'react';
import type { AppData, AppDefinition, Institution } from '@/client-app/types';
import type { MapEdge } from './graph';
import type { MapData } from './types';

/** What every node of the map needs: the data, the sample client's data, and the canvas actions. */
export interface MapContextValue {
  data: MapData;
  definition: AppDefinition;
  institution: Institution;
  /** The sample client's data (persona applied) the page frames render with. */
  appData: AppData | null;
  edges: MapEdge[];
  selected: string | null;
  /** Nodes and edges around the selection (everything when nothing is selected). */
  focus: { nodes: Set<string>; edges: Set<string> } | null;
  hoveredWidget: string | null;
  /** Go to a node like following a prototype link: the canvas flies there and selects it. */
  follow: (nodeId: string) => void;
  select: (nodeId: string | null) => void;
  /** The node's own editor (studio page, workflow editor, form editor). */
  open: (nodeId: string, detail?: { step?: string }) => void;
  hoverWidget: (widgetId: string | null) => void;
}

export const MapContext = createContext<MapContextValue | null>(null);

export function useMap() {
  const value = useContext(MapContext);
  if (!value) throw new Error('MapContext is missing');
  return value;
}

/** Where a handle of a node leads (the first edge leaving it). */
export const targetOf = (edges: MapEdge[], source: string, handle: string) => edges.find((e) => e.source === source && e.sourceHandle === handle)?.target ?? null;
