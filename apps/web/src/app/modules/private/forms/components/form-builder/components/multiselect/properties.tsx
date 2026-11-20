'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { useVariables } from '../../context/variables';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PropertiesProps } from '../../schemas';
import { MultiselectConfig } from '@repo/lintelia/schemas';

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

function OptionItem({
  option,
  index,
  onUpdate,
  onRemove,
}: {
  option: { label: string; value: string };
  index: number;
  onUpdate: (index: number, updates: Partial<typeof option>) => void;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: option.value });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2"
    >
      <button
        type="button"
        className="p-2 opacity-50 hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Input
        value={option.label}
        onChange={(e) => onUpdate(index, { label: e.target.value })}
        placeholder="Option label"
      />
      <Input
        value={option.value}
        onChange={(e) => onUpdate(index, { value: e.target.value })}
        placeholder="Option value"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function MultiselectProperties({
  config,
  onChange,
}: PropertiesProps<MultiselectConfig>) {
  const { definitions } = useVariables();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const source = config.source;
    if (source.type !== 'static') return;

    const oldIndex = source.options.findIndex(o => o.value === active.id);
    const newIndex = source.options.findIndex(o => o.value === over.id);

    const newOptions = [...source.options];
    const [removed] = newOptions.splice(oldIndex, 1);
    newOptions.splice(newIndex, 0, removed);

    updateConfig({
      source: {
        type: 'static',
        options: newOptions,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input
            value={config.label}
            onChange={(e) => updateConfig({ label: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Placeholder</Label>
          <Input
            value={config.placeholder || ''}
            onChange={(e) => updateConfig({ placeholder: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            value={config.description || ''}
            onChange={(e) => updateConfig({ description: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Minimum Selections</Label>
          <Input
            type="number"
            min={0}
            value={config.minSelect || ''}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : undefined;
              updateConfig({ minSelect: value });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Maximum Selections</Label>
          <Input
            type="number"
            min={1}
            value={config.maxSelect || ''}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value) : undefined;
              updateConfig({ maxSelect: value });
            }}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={config.required}
            onCheckedChange={(checked) => updateConfig({ required: checked })}
          />
          <Label>Required</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={config.searchable}
            onCheckedChange={(checked) => updateConfig({ searchable: checked })}
          />
          <Label>Searchable</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={config.creatable}
            onCheckedChange={(checked) => updateConfig({ creatable: checked })}
          />
          <Label>Allow Creating Options</Label>
        </div>
      </div>

      {/* Options Source */}
      <div className="space-y-4">
        <Label>Options Source</Label>
        <Select
          value={config.source.type}
          onValueChange={(value: 'static' | 'variable') => {
            if (value === 'static') {
              updateConfig({
                source: {
                  type: 'static',
                  options: [],
                },
              });
            } else {
              updateConfig({
                source: {
                  type: 'variable',
                  variableId: '',
                },
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select options source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Static Options</SelectItem>
            <SelectItem value="variable">From Variable</SelectItem>
          </SelectContent>
        </Select>

        {/* Static Options */}
        {(() => {
          const source = config.source;
          if (source.type !== 'static') return null;

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOptions = [...source.options];
                    const index = newOptions.length + 1;
                    newOptions.push({
                      label: `Option ${index}`,
                      value: `option-${index}`,
                    });
                    updateConfig({
                      source: {
                        type: 'static',
                        options: newOptions,
                      },
                    });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <DndContext
                sensors={sensors}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={source.options.map(o => o.value)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {source.options.map((option, index) => (
                      <OptionItem
                        key={option.value}
                        option={option}
                        index={index}
                        onUpdate={(index, updates) => {
                          const newOptions = [...source.options];
                          newOptions[index] = { ...newOptions[index], ...updates };
                          updateConfig({
                            source: {
                              type: 'static',
                              options: newOptions,
                            },
                          });
                        }}
                        onRemove={(index) => {
                          const newOptions = [...source.options];
                          newOptions.splice(index, 1);
                          updateConfig({
                            source: {
                              type: 'static',
                              options: newOptions,
                            },
                          });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          );
        })()}

        {/* Variable Source */}
        {(() => {
          const source = config.source;
          if (source.type !== 'variable') return null;

          return (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Variable</Label>
                <Select
                  value={source.variableId}
                  onValueChange={(value) => {
                    updateConfig({
                      source: {
                        type: 'variable',
                        variableId: value,
                        labelPath: source.labelPath,
                        valuePath: source.valuePath,
                      },
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(definitions)
                      .filter(([_, def]) => def.type === 'array')
                      .map(([id, def]) => (
                        <SelectItem key={id} value={id}>
                          {def.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Label Path</Label>
                <Input
                  value={source.labelPath || ''}
                  onChange={(e) => {
                    updateConfig({
                      source: {
                        type: 'variable',
                        variableId: source.variableId,
                        labelPath: e.target.value,
                        valuePath: source.valuePath,
                      },
                    });
                  }}
                  placeholder="e.g., name"
                />
              </div>

              <div className="space-y-2">
                <Label>Value Path</Label>
                <Input
                  value={source.valuePath || ''}
                  onChange={(e) => {
                    updateConfig({
                      source: {
                        type: 'variable',
                        variableId: source.variableId,
                        labelPath: source.labelPath,
                        valuePath: e.target.value,
                      },
                    });
                  }}
                  placeholder="e.g., id"
                />
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
} 