'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { registry } from './registry';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2 } from 'lucide-react';
import { VariablesProvider } from './context/variables';
import { Button } from '@/components/ui/button';
import { TestFormDialog } from './components/test-form-dialog';
import { FormConfig, FormEngineProps, FormVariable } from './schemas';
import { generateFormValuesSchema } from './validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, FormProvider } from 'react-hook-form';

// SortableComponent for editor mode
function SortableComponent({ componentConfig, isSelected, onSelect, onConfigChange, onDelete, formComponents }: any) {
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
      <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="p-2"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        {isSelected && (
          <button
            className="p-2 text-destructive hover:text-destructive/80"
            onClick={() => onDelete?.(componentConfig.id)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <component.Editor
        id={componentConfig.id}
        config={componentConfig.config}
        isSelected={isSelected}
        onSelect={onSelect}
        onConfigChange={onConfigChange}
        formComponents={formComponents}
      />
    </div>
  );
}

// Editor mode specific props
interface FormEngineEditorProps {
  config: FormConfig;
  onConfigChange?: (config: FormConfig) => void;
  selectedId?: string | null;
  onSelectComponent?: (id: string | null) => void;
  variables?: Record<string, unknown>;
  variableDefinitions?: Record<string, FormVariable>;
}

// Viewer mode specific props
interface FormEngineViewerProps {
  config: FormConfig;
  initialValues?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  variableDefinitions?: Record<string, FormVariable>;
  onChange?: (values: Record<string, unknown>) => void;
  onSubmit?: (values: Record<string, unknown>) => void;
}

// FormEngineEditor component
function FormEngineEditor({
  config,
  onConfigChange,
  selectedId,
  onSelectComponent,
  variables,
  variableDefinitions,
}: FormEngineEditorProps) {
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: 'canvas',
  });

  // Create a context value for variables
  const variablesContext = useMemo(() => ({
    variables: variables || {},
    definitions: variableDefinitions || config?.variables || {},
  }), [variables, variableDefinitions, config?.variables]);

  const handleDeleteComponent = useCallback((id: string) => {
    onConfigChange?.({
      ...config,
      components: config.components.filter(c => c.id !== id)
    });
    onSelectComponent?.(null);
  }, [config, onConfigChange, onSelectComponent]);

  const renderComponent = (componentConfig: typeof config.components[0]) => {
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
        onDelete={handleDeleteComponent}
        formComponents={config.components}
      />
    );
  };

  // Ensure config and components are properly initialized
  const components = config?.components || [];
  const isEmpty = components.length === 0;

  return (
    <VariablesProvider value={variablesContext}>
      <div>
        <div className="flex justify-between items-center mb-4">
          {config.id && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestDialogOpen(true)}
            >
              Test Form
            </Button>
          )}
        </div>
        <div
          ref={setDroppableRef}
          className={cn(
            'min-h-[200px] space-y-6 rounded-lg border-2 border-dashed p-4',
            isEmpty && 'flex items-center justify-center',
            'border-primary/20',
            isOver && 'border-primary bg-primary/5'
          )}
        >
          {isEmpty ? (
            <div className="text-center text-muted-foreground">
              Drag and drop components here
            </div>
          ) : (
            <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {components.map(renderComponent)}
            </SortableContext>
          )}
        </div>
      </div>

      {config.id && (
        <TestFormDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          formId={config.id}
          formConfig={config}
        />
      )}
    </VariablesProvider>
  );
}

// FormEngineViewer component
function FormEngineViewer({
  config,
  initialValues = {},
  variables,
  variableDefinitions,
  onChange,
  onSubmit,
}: FormEngineViewerProps) {
  // Create a context value for variables
  const variablesContext = useMemo(() => ({
    variables: variables || {},
    definitions: variableDefinitions || config?.variables || {},
  }), [variables, variableDefinitions, config?.variables]);

  // Create zod schema for react-hook-form
  const formSchema = useMemo(() => {
    if (config) {
      try {
        return generateFormValuesSchema(config);
      } catch (error) {
        console.error('Error generating form schema:', error);
        return null;
      }
    }
    return null;
  }, [config]);

  // Initialize react-hook-form with initial values
  const formMethods = useForm({
    resolver: zodResolver(formSchema!),
    defaultValues: (initialValues  || {}) as any,
    mode: 'onChange', // Validate on change for immediate feedback
  });

  // Watch all form values
  const formValues = formMethods.watch();
  
  // Track values for components that don't use react-hook-form (like layout components)
  const [layoutValues, setLayoutValues] = useState<Record<string, unknown>>({});

  // Update form when initialValues change
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      formMethods.reset(initialValues);
      
      // Extract layout component values
      const newLayoutValues: Record<string, unknown> = {};
      config.components.forEach(component => {
        if (!component.config.propertyName) {
          const id = component.id;
          if (initialValues[id] !== undefined) {
            newLayoutValues[id] = initialValues[id];
          }
        }
      });
      
      setLayoutValues(newLayoutValues);
    }
  }, [initialValues, formMethods, config.components]);

  // Notify parent of changes when form values change
  useEffect(() => {
    onChange?.(formValues);
  }, [formValues, onChange]);

  const renderComponent = (componentConfig: typeof config.components[0]) => {
    const component = registry.get(componentConfig.type);
    if (!component) return null;

    // Get propertyName if it exists, otherwise use component ID
    const propertyName = componentConfig.config.propertyName as string || componentConfig.id;
    
    // Check if this is a layout component (no propertyName)
    const isLayoutComponent = !componentConfig.config.propertyName;

    return (
      <component.Viewer
        key={componentConfig.id}
        id={componentConfig.id}
        config={componentConfig.config}
        value={isLayoutComponent ? layoutValues[componentConfig.id] : formValues[propertyName]}
        onChange={(value) => {
          if (isLayoutComponent) {
            // For layout components, use our custom state management
            setLayoutValues(prev => ({
              ...prev,
              [componentConfig.id]: value
            }));
          } else {
            // For input components, let react-hook-form handle it
            // (this will be handled by the controller in the component)
            formMethods.setValue(propertyName, value, {
              shouldValidate: true,
              shouldDirty: true,
              shouldTouch: true
            });
          }
        }}
        onBlur={() => {
          if (!isLayoutComponent) {
            // Trigger validation on blur for react-hook-form fields
            formMethods.trigger(propertyName);
          }
        }}
        error={isLayoutComponent ? undefined : formMethods.formState.errors[propertyName]?.message as string}
        formValues={formValues}
        // Pass react-hook-form props to non-layout components
        register={!isLayoutComponent ? formMethods.register : undefined}
        formState={!isLayoutComponent ? formMethods.formState : undefined}
        control={!isLayoutComponent ? formMethods.control : undefined}
      />
    );
  };

  // Ensure config and components are properly initialized
  const components = config?.components || [];

  // Handle form submission
  const handleSubmit = () => {
    // Merge data from react-hook-form with any layout component values
    onSubmit?.(formValues);
  };

  if (!formSchema) {
    return (
      <div className="text-red-500">
        Error: Unable to generate form schema. Please check form configuration.
      </div>
    );
  }

  return (
    <VariablesProvider value={variablesContext}>
      <FormProvider {...formMethods}>
        <form 
          onSubmit={formMethods.handleSubmit(handleSubmit)} 
          noValidate
        >
          <div className="space-y-6">
            {components.map(renderComponent)}
            <div className="flex justify-end">
              <Button type="submit">Submit</Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </VariablesProvider>
  );
}

// Main FormEngine component that serves as an entry point
export function FormEngine(props: FormEngineProps) {
  const { mode, ...restProps } = props;
  
  if (mode === 'editor') {
    return <FormEngineEditor {...restProps as FormEngineEditorProps} />;
  }
  
  return <FormEngineViewer {...restProps as FormEngineViewerProps} />;
} 