import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { componentEvents, type ComponentDefinition, type NodeData } from '@repo/fintivio/schemas';
import { CATEGORY_LABELS, iconFor } from './catalog';

const ORDER = ['people', 'client', 'case', 'flow', 'data', 'communication', 'connector'];

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
    <div className="flex flex-col gap-3 p-1" role="region" aria-label="Components">
      <p className="text-xs text-muted-foreground">Click or drag to add</p>
      {groups.map(({ category, items }) => (
        <div key={category} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CATEGORY_LABELS[category] ?? category}</p>
          {items.map((definition) => {
            const Icon = iconFor(definition.icon);
            return (
              <button
                key={definition.type}
                type="button"
                draggable
                title={definition.description}
                className="flex w-full items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-left text-sm hover:bg-accent"
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/reactflow', JSON.stringify(newStep(definition)));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => onAdd(newStep(definition))}
              >
                <Icon className="h-4 w-4 shrink-0" />
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
