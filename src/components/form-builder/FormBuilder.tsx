'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormConfig, FormField, FormComponentDefinition, FormComponentProps } from './types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { GripVertical } from 'lucide-react';
import * as components from './components';
import { Button } from '../ui/button';
import { v4 as uuid } from 'uuid';
import { Input } from '@/components/ui/input';

interface FormBuilderProps {
  initialConfig?: FormConfig;
  onChange?: (config: FormConfig) => void;
  className?: string;
  onSave?: (form: FormConfig) => unknown;
  onCancel?: () => unknown;
}

// Convert components object into an array
const COMPONENTS = Object.values(components) as FormComponentDefinition[];

// Add this new component
function SortableField({ field, onSelect, isSelected, onChange }: FormComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const component = COMPONENTS.find(c => c.type === field.type);
  if (!component) return null;

  const Component = component.canvas;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50')}
    >
      <div className="group relative">
        <button
          className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Component
          field={field}
          onSelect={onSelect}
          isSelected={isSelected}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function Droppable({ children, id, overChange, className }: React.PropsWithChildren<{ id: string, overChange?: (isOver: boolean) => unknown, className?: string }>) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  useEffect(() => {
    overChange?.(isOver);
  }, [isOver, overChange]);

  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}

export function FormBuilder({ initialConfig, onChange, className, onSave, onCancel }: FormBuilderProps) {
  const [config, setConfig] = useState<FormConfig>(() => initialConfig || {
    id: uuid(),
    name: 'New Form',
    description: '',
    fields: [],
  });
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [isOverCanvas, setIsOverCanvas] = useState(false);

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (!type) return;

    setActiveId(type);
    document.body.style.cursor = 'grabbing';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    document.body.style.cursor = '';

    const { active, over } = event;

    // Handle dropping new components from toolbar
    if (active.data.current?.type && over?.id === 'canvas') {
      const type = active.data.current.type;
      const component = COMPONENTS.find(c => c.type === type);
      if (!component) return;

      const newField: FormField = {
        id: uuid(),
        type: component.type,
        label: component.label,
      };

      const newConfig = {
        ...config,
        fields: [...config.fields, newField],
      };

      setConfig(newConfig);
      onChange?.(newConfig);
      setSelectedField(newField);
      return;
    }

    // Handle reordering existing fields
    if (active.id !== over?.id && over) {
      const oldIndex = config.fields.findIndex(f => f.id === active.id);
      const newIndex = config.fields.findIndex(f => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = [...config.fields];
        const [removed] = newFields.splice(oldIndex, 1);
        newFields.splice(newIndex, 0, removed);

        const newConfig = {
          ...config,
          fields: newFields,
        };

        setConfig(newConfig);
        onChange?.(newConfig);
      }
    }
  };

  const handleFieldChange = (field: FormField) => {
    const index = config.fields.findIndex(f => f.id === field.id);
    if (index === -1) return;

    const newFields = [...config.fields];
    newFields[index] = field;

    const newConfig = {
      ...config,
      fields: newFields,
    };

    setConfig(newConfig);
    onChange?.(newConfig);
    setSelectedField(field);
  };

  const renderDragOverlay = () => {
    if (!activeId) return null;

    const component = COMPONENTS.find(c => c.type === activeId);
    if (!component) return null;

    const { toolbar: Toolbar } = component;
    return <Toolbar />;
  };

  const updateForm = (updates: Partial<FormConfig>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...updates }));
    onChange?.(config);
  };

  return (
    <div className={cn('relative flex h-full gap-4 p-4', className)}>
      {/* Form Header */}
      <div className="absolute top-0 left-0 right-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Input
              value={config.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="Enter form name"
              className="w-[300px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onCancel?.()}>
              Cancel
            </Button>
            <Button onClick={() => onSave?.(config)}>
              Save Form
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - adjust top margin to account for header */}
      <div className="flex w-full gap-4 mt-[70px]">
        {/* Properties Panel */}
        <div className="w-80 flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 font-semibold">Properties</div>
          <Separator />
          <ScrollArea className="flex-1 p-4">
            {selectedField ? (
              (() => {
                const component = COMPONENTS.find(c => c.type === selectedField.type);
                if (!component) return null;

                const Properties = component.properties;
                return (
                  <Properties
                    field={selectedField}
                    onChange={handleFieldChange}
                  />
                );
              })()
            ) : (
              <div className="text-sm text-muted-foreground">
                Select a field to edit its properties
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Canvas */}
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-4 font-semibold">Canvas</div>
            <Separator />
            <ScrollArea className="flex-1 p-4">
              <Droppable
                id="canvas"
                overChange={setIsOverCanvas}
                className={cn(
                  'min-h-[400px] h-full w-full rounded-lg border-2 border-dashed transition-colors',
                  isOverCanvas ? 'border-primary bg-accent/50' : 'border-muted-foreground/25'
                )}
              >
                <div className="p-4">
                  <SortableContext items={config.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {config.fields.length === 0 ? (
                      <div className="h-[360px] flex items-center justify-center text-muted-foreground">
                        Drag and drop fields here
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {config.fields.map(field => (
                          <SortableField
                            key={field.id}
                            field={field}
                            onSelect={() => setSelectedField(field)}
                            isSelected={selectedField?.id === field.id}
                            onChange={handleFieldChange}
                          />
                        ))}
                      </div>
                    )}
                  </SortableContext>
                </div>
              </Droppable>
            </ScrollArea>
          </div>

          {/* Components Panel */}
          <div className="w-80 flex flex-col rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-4 font-semibold">Components</div>
            <Separator />
            <ScrollArea className="flex-1 p-4">
              <div className="grid grid-cols-2 gap-2">
                {COMPONENTS.map(({ type, toolbar: Toolbar }) => (
                  <Toolbar key={type} />
                ))}
              </div>
            </ScrollArea>
          </div>

          <DragOverlay>
            {renderDragOverlay()}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
} 