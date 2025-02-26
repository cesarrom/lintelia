'use client';
import { useState } from 'react';
import { FormConfig } from './types';
import { FormEngine } from './form-engine';
import { registry } from './registry';
import { textComponent } from './components/text';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { v4 as uuid } from 'uuid';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { FormSettings } from './components/form-settings';
import { Settings2 } from 'lucide-react';

// Register components
registry.register(textComponent);

interface FormBuilderProps {
  initialConfig?: FormConfig;
  onSave?: (config: FormConfig) => void;
  onCancel?: () => void;
}

export function FormBuilder({ initialConfig, onSave, onCancel }: FormBuilderProps) {
  const [config, setConfig] = useState<FormConfig>(() => initialConfig || {
    id: uuid(),
    name: 'New Form',
    description: '',
    variables: {},
    components: [],
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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
      const component = registry.get(type);
      if (!component) return;

      // Create a new component with default config
      const defaultConfig = component.schema.config.parse({
        label: `New ${component.label}`,
      });

      const newComponent = {
        id: uuid(),
        type,
        config: defaultConfig,
      };

      setConfig(prev => ({
        ...prev,
        components: [...prev.components, newComponent],
      }));
      return;
    }

    // Handle reordering existing components
    if (active.id !== over?.id && over?.id) {
      const oldIndex = config.components.findIndex(c => c.id === active.id);
      const newIndex = config.components.findIndex(c => c.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newComponents = [...config.components];
        const [removed] = newComponents.splice(oldIndex, 1);
        newComponents.splice(newIndex, 0, removed);

        setConfig(prev => ({
          ...prev,
          components: newComponents,
        }));
      }
    }
  };

  const selectedComponent = selectedId 
    ? config.components.find(c => c.id === selectedId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-4">
        {/* Components Toolbar */}
        <div className="w-64 flex-none rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 font-semibold">Components</div>
          <Separator />
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="space-y-2 p-4">
              {registry.getByCategory('input').map((component) => (
                <component.components.Toolbar key={component.type} />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Form Canvas */}
        <div className="flex-1 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold">{config.name}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => onSave?.(config)}>
                Save Form
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4">
              <FormEngine
                mode="editor"
                config={config}
                onConfigChange={setConfig}
                selectedId={selectedId}
                onSelectComponent={setSelectedId}
              />
            </div>
          </ScrollArea>
        </div>

        {/* Properties Panel */}
        <div className="w-80 flex-none rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-4 font-semibold">
            {showSettings ? 'Form Settings' : 'Properties'}
          </div>
          <Separator />
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="p-4">
              {showSettings ? (
                <FormSettings
                  config={config}
                  onChange={(newConfig) => {
                    setConfig(newConfig);
                    // Keep settings open
                  }}
                />
              ) : selectedComponent ? (
                (() => {
                  const component = registry.get(selectedComponent.type);
                  if (!component) return null;

                  return (
                    <component.components.Properties
                      config={selectedComponent.config}
                      onChange={(newConfig) => {
                        setConfig(prev => ({
                          ...prev,
                          components: prev.components.map(c =>
                            c.id === selectedId ? { ...c, config: newConfig } : c
                          ),
                        }));
                      }}
                    />
                  );
                })()
              ) : (
                <div className="text-sm text-muted-foreground">
                  Select a component to edit its properties or click the settings icon to edit form settings
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DragOverlay>
          {activeId && (() => {
            const component = registry.get(activeId);
            if (!component) return null;
            return <component.components.Toolbar />;
          })()}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

export function FormViewer({
  config,
  initialValues,
  onChange,
  onSubmit,
}: {
  config: FormConfig;
  initialValues?: Record<string, unknown>;
  onChange?: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <FormEngine
        mode="viewer"
        config={config}
        initialValues={initialValues}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </div>
  );
} 