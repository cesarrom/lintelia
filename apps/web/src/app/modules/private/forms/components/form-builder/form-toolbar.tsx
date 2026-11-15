import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { registry } from './registry';
import { ComponentCategory } from './schemas';

interface FormToolbarProps {
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  /** Add a component by clicking it (drag and drop remains available). */
  onAdd?: (type: string) => void;
}

export function FormToolbar({ onDragStart, onDragEnd, onAdd }: FormToolbarProps) {
  const categories: Record<ComponentCategory, string> = {
    input: 'Input Fields',
    layout: 'Layout',
    container: 'Containers',
  };

  const componentsByCategory = Object.entries(categories).map(([category, label]) => ({
    category,
    label,
    components: registry.getByCategory(category as ComponentCategory),
  }));

  return (
    <div className="space-y-6">
      {componentsByCategory.map(({ category, label, components }) => (
        components.length > 0 && (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
            <div className="space-y-2">
              {components.map((component) => (
                <div
                  key={component.type}
                  data-component-type={component.type}
                  title={`Add ${component.label}`}
                  onClick={() => onAdd?.(component.type)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onAdd?.(component.type);
                    }
                  }}
                >
                  <component.Toolbar
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
} 