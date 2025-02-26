'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormEngineProps } from './types';
import { registry } from './registry';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import { VariablesProvider } from './context/variables';

function SortableComponent({ componentConfig, isSelected, onSelect, onConfigChange }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: componentConfig.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const component = registry.get(componentConfig.type);
  if (!component) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative group', isDragging && 'opacity-50')}
    >
      <button
        className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <component.components.Editor
        id={componentConfig.id}
        config={componentConfig.config}
        isSelected={isSelected}
        onSelect={onSelect}
        onConfigChange={onConfigChange}
      />
    </div>
  );
}

export function FormEngine({
  mode,
  config,
  initialValues,
  variables,
  onChange,
  onSubmit,
  onConfigChange,
  selectedId,
  onSelectComponent,
}: FormEngineProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues || {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: 'canvas',
  });

  // Create a context value for variables
  const variablesContext = useMemo(() => ({
    variables: variables || {},
    definitions: config.variables,
  }), [variables, config.variables]);

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const handleValueChange = useCallback(
    (id: string, value: unknown) => {
      const newValues = { ...values, [id]: value };
      setValues(newValues);
      onChange?.(newValues);
    },
    [values, onChange]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit?.(values);
    },
    [values, onSubmit]
  );

  const renderComponent = (componentConfig: typeof config.components[0]) => {
    const component = registry.get(componentConfig.type);
    if (!component) return null;

    if (mode === 'editor') {
      return (
        <SortableComponent
          key={componentConfig.id}
          componentConfig={componentConfig}
          isSelected={selectedId === componentConfig.id}
          onSelect={() => onSelectComponent?.(componentConfig.id)}
          onConfigChange={(newConfig: any) => {
            onConfigChange?.({
              ...config,
              components: config.components.map((c) =>
                c.id === componentConfig.id ? { ...c, config: newConfig } : c
              ),
            });
          }}
        />
      );
    }

    return (
      <component.components.Viewer
        key={componentConfig.id}
        id={componentConfig.id}
        config={componentConfig.config}
        value={values[componentConfig.id]}
        onChange={(value) => handleValueChange(componentConfig.id, value)}
        error={errors[componentConfig.id]}
      />
    );
  };

  return (
    <VariablesProvider value={variablesContext}>
      <form onSubmit={handleSubmit}>
        <div
          ref={setDroppableRef}
          className={cn(
            'min-h-[200px] space-y-6 rounded-lg border-2 border-dashed p-4',
            config.components.length === 0 && 'flex items-center justify-center',
            mode === 'editor' && 'border-primary/20',
            isOver && 'border-primary bg-primary/5'
          )}
        >
          {config.components.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Drag and drop components here
            </div>
          ) : mode === 'editor' ? (
            <SortableContext items={config.components.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {config.components.map(renderComponent)}
            </SortableContext>
          ) : (
            config.components.map(renderComponent)
          )}
        </div>
      </form>
    </VariablesProvider>
  );
} 