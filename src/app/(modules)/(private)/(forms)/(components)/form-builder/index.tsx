'use client';
import { useState } from 'react';
import { FormConfig, FormVariable } from './schemas';
import { FormEngine } from './form-engine';
import { registry } from './registry';
import {
  textComponent,
  emailComponent,
  selectComponent,
  multiselectComponent,
  checkboxComponent,
  radioComponent,
  ratingComponent,
  rangeComponent,
  dateComponent,
  timeComponent,
  datetimeComponent,
  fileComponent,
  imageComponent,
  colorComponent,
  columnsComponent,
  sectionComponent,
  separatorComponent,
  pageSeparatorComponent,
  textareaComponent,
  urlComponent,
  numberComponent,
  passwordComponent,
  phoneComponent,
  richtextComponent,
} from './components';
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
import { Settings2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { generateFormWithAI } from '../../(actions)/actions';
import { toast } from 'sonner';

// Register components
registry.register(textComponent);
registry.register(emailComponent);
registry.register(selectComponent);
registry.register(multiselectComponent);
registry.register(checkboxComponent);
registry.register(radioComponent);
registry.register(ratingComponent);
registry.register(rangeComponent);
registry.register(dateComponent);
registry.register(timeComponent);
registry.register(datetimeComponent);
registry.register(fileComponent);
registry.register(imageComponent);
registry.register(colorComponent);
registry.register(columnsComponent);
registry.register(sectionComponent);
registry.register(separatorComponent);
registry.register(pageSeparatorComponent);
registry.register(textareaComponent);
registry.register(urlComponent);
registry.register(numberComponent);
registry.register(passwordComponent);
registry.register(phoneComponent);
registry.register(richtextComponent);

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');

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

  const handleComponentSelect = (id: string | null) => {
    setSelectedId(id);
    setShowSettings(false); // Close settings when selecting a component
  };

  const handleAIGenerate = async (userPrompt: string) => {
    try {
      setIsGenerating(true);
      const response = await generateFormWithAI(userPrompt, config);
      
      if (response.error) {
        toast.error(response.error);
        return;
      }

      if (response.result) {
        // Merge the AI-generated components with existing ones
        setConfig(prev => ({
          ...prev,
          components: [
            ...prev.components,
            ...(response.result.components || []).map(c => ({
              ...c,
              id: uuid(), // Ensure unique IDs
            })),
          ],
          variables: {
            ...prev.variables,
            ...(response.result.variables || {}),
          },
        }));
        toast.success('Form updated with AI suggestions');
      }
    } catch (error: any) {
      toast.error('Failed to generate form: ' + error.message);
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-[calc(95vh-8rem)]">
        <div className="flex flex-1 gap-4 p-6 overflow-hidden">
          {/* Components Toolbar */}
          <div className="w-64 flex-none rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 font-semibold border-b">Components</div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-4">
                {registry.getAll().map((component) => (
                  <component.components.Toolbar key={component.type} />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Form Canvas */}
          <div className="flex-1 rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
            <div className="flex h-14 items-center justify-between border-b px-4 flex-none">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">{config.name}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowSettings(true);
                    setSelectedId(null);
                  }}
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
            <ScrollArea className="flex-1">
              <div className="p-4">
                <FormEngine
                  mode="editor"
                  config={config}
                  onConfigChange={setConfig}
                  selectedId={selectedId}
                  onSelectComponent={handleComponentSelect}
                />
              </div>
            </ScrollArea>
          </div>

          {/* Properties Panel */}
          <div className="w-80 flex-none rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
            <div className="flex h-14 items-center justify-between border-b px-4 flex-none">
              <div className="font-semibold">
                {showSettings ? 'Form Settings' : 'Properties'}
              </div>
              {showSettings && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {showSettings ? (
                  <FormSettings
                    config={config}
                    onChange={setConfig}
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
        </div>
        
        {/* AI Chat Interface */}
        <div className="border-t p-4 bg-card flex-none">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (prompt.trim()) {
                handleAIGenerate(prompt);
              }
            }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="Describe what changes you want to make to the form..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              variant="secondary"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-4 w-4" />
              )}
              <span className="ml-2">Ask AI</span>
            </Button>
          </form>
        </div>
      </div>

      <DragOverlay>
        {activeId && (() => {
          const component = registry.get(activeId);
          if (!component) return null;
          return <component.components.Toolbar />;
        })()}
      </DragOverlay>
    </DndContext>
  );
}

export function FormViewer({
  config,
  initialValues,
  variables,
  onChange,
  onSubmit,
}: {
  config: FormConfig;
  initialValues?: Record<string, unknown>;
  variables?: {
    values: Record<string, unknown>;
    definitions: Record<string, FormVariable>;
  };
  onChange?: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <FormEngine
        mode="viewer"
        config={config}
        initialValues={initialValues}
        variables={variables?.values}
        variableDefinitions={variables?.definitions}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </div>
  );
} 