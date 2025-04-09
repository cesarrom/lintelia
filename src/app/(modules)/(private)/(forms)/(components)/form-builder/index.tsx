'use client';
import { useMemo, useState } from 'react';
import { FormConfig, FormVariable, FormComponentConfig, formConfigSchema, generateValidationConfig } from './schemas';
import { FormEngine } from './form-engine';
import { registry } from './registry';
import {
  textComponent,
  checkboxComponent,
  dateComponent,
  colorComponent,
  datetimeComponent,
  emailComponent,
  fileComponent,
  imageComponent,
  multiselectComponent,
  numberComponent,
  pageSeparatorComponent,
  passwordComponent,
  phoneComponent,
  radioComponent,
  rangeComponent,
  ratingComponent,
  richtextComponent,
  selectComponent,
  separatorComponent,
  textareaComponent,
  urlComponent,
} from './components';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { FormToolbar } from './form-toolbar';
import { VariablesProvider } from './context/variables';

// Register components
registry.register(textComponent);
registry.register(checkboxComponent);
registry.register(colorComponent);
registry.register(dateComponent);
registry.register(emailComponent);
registry.register(selectComponent);
registry.register(multiselectComponent);
registry.register(radioComponent);
registry.register(ratingComponent);
registry.register(datetimeComponent);
registry.register(fileComponent);
registry.register(imageComponent);
registry.register(pageSeparatorComponent);
registry.register(separatorComponent);
registry.register(numberComponent);
registry.register(passwordComponent);
registry.register(phoneComponent);
registry.register(richtextComponent);
registry.register(textareaComponent);
registry.register(urlComponent);

interface FormBuilderProps {
  initialConfig?: FormConfig;
  onSave?: (config: FormConfig) => void;
  onCancel?: () => void;
}

export function FormBuilder({ initialConfig, onSave, onCancel }: FormBuilderProps) {
  const [config, setConfig] = useState<FormConfig>(() => ({
    id: initialConfig?.id || uuid(),
    name: initialConfig?.name || 'New Form',
    description: initialConfig?.description || '',
    variables: initialConfig?.variables || {},
    components: initialConfig?.components || [],
  }));

  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [activeComponent, setActiveComponent] = useState<{ type: string; config: any } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (!type) return;

    setActiveId(type);
    setActiveComponent({
      type,
      config: active.data.current?.config,
    });
    document.body.style.cursor = 'grabbing';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveComponent(null);
    document.body.style.cursor = '';

    // Handle dropping new components from toolbar
    if (active.data.current?.type && over?.id === 'canvas') {
      const type = active.data.current.type;
      const component = registry.get(type);
      if (!component) return;

      // Create new component instance using the provided config
      const newComponent: FormComponentConfig = {
        id: uuid(),
        type,
        config: active.data.current.config,
      };

      setConfig(prev => ({
        ...prev,
        components: [...prev.components, newComponent],
      }));
      return;
    }

    // Handle reordering existing components
    if (active.id !== over?.id && over?.id) {
      const oldIndex = config.components.findIndex((component: FormComponentConfig) => component.id === active.id);
      const newIndex = config.components.findIndex((component: FormComponentConfig) => component.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newComponents = [...config.components];
        const [removed] = newComponents.splice(oldIndex, 1);
        newComponents.splice(newIndex, 0, removed);

        setConfig(prev => formConfigSchema.parse({
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
        setConfig(prev => {
          const newConfig = {
            ...prev,
            components: [
              ...prev.components,
              ...(response.result?.components || []).map((c: FormComponentConfig) => ({
                ...c,
                id: uuid(), // Ensure unique IDs
              })),
            ],
            variables: {
              ...prev.variables,
              ...(response.result?.variables || {}),
            },
          };
          return formConfigSchema.parse(newConfig);
        });
        toast.success('Form updated with AI suggestions');
      }
    } catch (error: any) {
      toast.error('Failed to generate form: ' + error.message);
    } finally {
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const handleConfigChange = (newConfig: FormConfig) => {
    // Ensure variables is always defined
    setConfig(formConfigSchema.parse({
      ...newConfig,
      variables: newConfig.variables || {},
    }));
  };



  // Create a context value for variables
  const variablesContext = useMemo(() => {
    return {
      variables: {},
      definitions: config?.variables || {},
    };
  }, [config?.variables]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <VariablesProvider {...variablesContext}>
        <div className="flex flex-col h-[calc(95vh-8rem)]">
          <div className="flex flex-1 gap-4 p-6 overflow-hidden">
            {/* Components Toolbar */}
            <div className="w-64 flex-none rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 font-semibold border-b">Components</div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 p-4">
                  <FormToolbar />
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
                  <Button onClick={() => onSave?.(generateValidationConfig(config))}>
                    Save Form
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <FormEngine
                    mode="editor"
                    config={config}
                    onConfigChange={handleConfigChange}
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
                        <component.Properties
                          config={selectedComponent.config}
                          onChange={(newConfig) => {
                            const schema = component.getConfigSchema();
                            const validationResult = schema.safeParse(newConfig);
                            if (!validationResult.success) {
                              toast.error('Invalid configuration');
                              return;
                            }

                            setConfig(prev => ({
                              ...prev,
                              components: prev.components.map((c: FormComponentConfig) =>
                                c.id === selectedComponent.id
                                  ? { ...c, config: validationResult.data }
                                  : c
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
          {activeComponent && (() => {
            const component = registry.get(activeComponent.type);
            if (!component) return null;
            return <component.Toolbar />;
          })()}
        </DragOverlay>
      </VariablesProvider>
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