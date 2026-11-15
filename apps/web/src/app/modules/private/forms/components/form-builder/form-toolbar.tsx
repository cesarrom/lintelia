import { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { registry } from './registry';
import { ComponentCategory } from './schemas';

interface FormToolbarProps {
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
}

export function FormToolbar({ onDragStart, onDragEnd }: FormToolbarProps) {
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
                <component.Toolbar
                  key={component.type}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
} 