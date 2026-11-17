import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { componentEvents, type ComponentDefinition, type NodeData } from '@repo/fintivio/schemas';
import { CATEGORY_LABELS, categoryStyle, iconFor } from './catalog';
import { cn } from '@/lib/utils';

const ORDER = ['people', 'client', 'case', 'flow', 'data', 'communication', 'connector', 'function'];

/** A new step of this component with its default configuration. */
export function newStep(definition: ComponentDefinition): NodeData {
  const id = `${definition.type.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_${uuid().slice(0, 6)}`;
  const config = structuredClone(definition.defaults ?? {}) as Record<string, unknown>;
  return {
    id, type: definition.type, name: definition.title, description: '', config, inputs: [],
    events: componentEvents(definition, config).map((name) => ({ name, outputs: [], next: [] })),
  } as NodeData;
}

/** Components grouped by category; drag onto the canvas or click to add. */
export function Palette({ components, onAdd, legacy }: { components: ComponentDefinition[]; onAdd: (data: NodeData) => void; legacy?: React.ReactNode }) {
  const [showLegacy, setShowLegacy] = useState(false);
  const groups = ORDER.map((category) => ({ category, items: components.filter((c) => c.category === category && !c.hidden) })).filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-5" role="region" aria-label="Components">
      <div>
        <p className="text-[13px] font-semibold">Components</p>
        <p className="text-xs text-muted-foreground">Click or drag onto the canvas</p>
      </div>
      {groups.map(({ category, items }) => (
        <div key={category} className="space-y-0.5">
          <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/90">{CATEGORY_LABELS[category] ?? category}</p>
          {items.map((definition) => {
            const Icon = iconFor(definition.icon);
            return (
              <button
                key={definition.type}
                type="button"
                draggable
                title={definition.description}
                className="group flex w-full cursor-grab items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-background hover:shadow-raised active:cursor-grabbing"
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/reactflow', JSON.stringify(newStep(definition)));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onAdd(newStep(definition))}
              >
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', categoryStyle(category).tile)}><Icon className="h-3.5 w-3.5" /></span>
                <span className="truncate">{definition.title}</span>
              </button>
            );
          })}
        </div>
      ))}
      {legacy && (
        <div className="space-y-1">
          <button type="button" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground" onClick={() => setShowLegacy(!showLegacy)}>
            {showLegacy ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} Legacy (being retired)
          </button>
          {showLegacy && <div className="flex flex-col gap-2">{legacy}</div>}
        </div>
      )}
    </div>
  );
}
