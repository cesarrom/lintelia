'use client';

import { useState } from 'react';
import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SortableOptionProps {
  id: string;
  label: string;
  value: string;
  onLabelChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
  isSelected?: boolean;
  onToggle?: () => void;
}

function SortableOption({ 
  id, 
  label, 
  value, 
  onLabelChange, 
  onValueChange, 
  onRemove,
  isSelected,
  onToggle,
}: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border bg-card',
        isDragging && 'opacity-50'
      )}
    >
      <button
        className="p-1 hover:bg-accent rounded-md cursor-grab"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 flex gap-2">
        <Input
          placeholder="Label"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
        />
        <Input
          placeholder="Value"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      </div>
      <Button
        variant={isSelected ? 'secondary' : 'ghost'}
        size="sm"
        onClick={onToggle}
        className="px-2"
      >
        Selected
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MultiselectProperties({ field, onChange }: FormComponentProps) {
  const [options, setOptions] = useState(field.options || []);
  const selectedValues = new Set(field.defaultValue as string[] || []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  if (!onChange) return null;

  const updateOptions = (newOptions: typeof options) => {
    setOptions(newOptions);
    onChange({ ...field, options: newOptions });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = options.findIndex((opt) => opt.value === active.id);
    const newIndex = options.findIndex((opt) => opt.value === over.id);

    const newOptions = [...options];
    const [removed] = newOptions.splice(oldIndex, 1);
    newOptions.splice(newIndex, 0, removed);

    updateOptions(newOptions);
  };

  const toggleOption = (value: string) => {
    const newSelected = new Set(selectedValues);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    onChange({ ...field, defaultValue: Array.from(newSelected) });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Multiselect-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Selected Values</Label>
          <div className="flex flex-wrap gap-1 min-h-[2.5rem] rounded-md border bg-muted px-3 py-2">
            {Array.from(selectedValues).map(value => {
              const option = options.find(opt => opt.value === value);
              if (!option) return null;
              return (
                <Badge 
                  key={value} 
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => toggleOption(value)}
                >
                  {option.label}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                const newOption = {
                  label: `Option ${options.length + 1}`,
                  value: `option_${options.length + 1}`,
                };
                updateOptions([...options, newOption]);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Option
            </Button>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={options.map(opt => opt.value)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <SortableOption
                    key={option.value}
                    id={option.value}
                    label={option.label}
                    value={option.value}
                    isSelected={selectedValues.has(option.value)}
                    onToggle={() => toggleOption(option.value)}
                    onLabelChange={(label) => {
                      const newOptions = [...options];
                      newOptions[index] = { ...option, label };
                      updateOptions(newOptions);
                    }}
                    onValueChange={(value) => {
                      const newOptions = [...options];
                      newOptions[index] = { ...option, value };
                      updateOptions(newOptions);
                    }}
                    onRemove={() => {
                      const newOptions = options.filter((_, i) => i !== index);
                      updateOptions(newOptions);
                      if (selectedValues.has(option.value)) {
                        toggleOption(option.value);
                      }
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
} 