'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormEngineProps } from './types';
import { registry } from './registry';
import { cn } from '@/lib/utils';
import { GripVertical, Trash2 } from 'lucide-react';
import { VariablesProvider } from './context/variables';
import { Button } from '@/components/ui/button';
import { TestFormDialog } from './components/test-form-dialog';

function validateField(value: unknown, component: any) {
  const errors: string[] = [];
  
  // Check required
  if (component.config.required && (!value || (typeof value === 'string' && !value.trim()))) {
    errors.push('This field is required');
    return errors[0]; // Return first error for required fields immediately
  }

  // Skip other validations if empty and not required
  if (!value || (typeof value === 'string' && !value.trim())) {
    return '';
  }

  // Process validation rules
  component.config.validation?.forEach((rule: any) => {
    const stringValue = String(value);
    
    switch (rule.type) {
      case 'minLength':
        if (stringValue.length < rule.value) {
          errors.push(rule.message);
        }
        break;
      case 'maxLength':
        if (stringValue.length > rule.value) {
          errors.push(rule.message);
        }
        break;
      case 'pattern':
        if (!new RegExp(rule.value).test(stringValue)) {
          errors.push(rule.message);
        }
        break;
    }
  });

  return errors[0] || ''; // Return first error or empty string
}

function SortableComponent({ componentConfig, isSelected, onSelect, onConfigChange, onDelete }: any) {
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
  variableDefinitions,
  onChange,
  onSubmit,
  onConfigChange,
  selectedId,
  onSelectComponent,
}: FormEngineProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: 'canvas',
  });

  // Create a context value for variables
  const variablesContext = useMemo(() => ({
    variables: variables || {},
    definitions: variableDefinitions || config?.variables || {},
  }), [variables, variableDefinitions, config?.variables]);

  useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
      // Validate initial values
      const newErrors: Record<string, string> = {};
      config?.components?.forEach((component) => {
        const value = initialValues[component.id];
        const error = validateField(value, component);
        if (error) {
          newErrors[component.id] = error;
        }
      });
      setErrors(newErrors);
    }
  }, [initialValues, config?.components]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    config?.components?.forEach((component) => {
      const value = values[component.id];
      const error = validateField(value, component);
      if (error) {
        newErrors[component.id] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, config?.components]);

  const handleValueChange = useCallback(
    (id: string, value: unknown) => {
      const newValues = { ...values, [id]: value };
      setValues(newValues);
      
      // Find component and validate
      const component = config?.components?.find(c => c.id === id);
      if (component) {
        const error = validateField(value, component);
        setErrors(prev => ({
          ...prev,
          [id]: error
        }));
      }

      onChange?.(newValues);
    },
    [values, onChange, config?.components]
  );

  const handleBlur = useCallback((id: string) => {
    setTouchedFields(prev => ({
      ...prev,
      [id]: true
    }));

    // Validate on blur
    const component = config?.components?.find(c => c.id === id);
    if (component) {
      const value = values[id];
      const error = validateField(value, component);
      setErrors(prev => ({
        ...prev,
        [id]: error
      }));
    }
  }, [values, config?.components]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      
      // Mark all fields as touched
      const allTouched: Record<string, boolean> = {};
      config?.components?.forEach(component => {
        allTouched[component.id] = true;
      });
      setTouchedFields(allTouched);

      // Validate all fields
      const isValid = validateForm();
      
      if (isValid) {
        onSubmit?.(values);
      }
    },
    [values, onSubmit, validateForm, config?.components]
  );

  const handleDeleteComponent = useCallback((id: string) => {
    onConfigChange?.({
      ...config,
      components: config.components.filter(c => c.id !== id)
    });
    onSelectComponent?.(null);
  }, [config, onConfigChange, onSelectComponent]);

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
          onDelete={handleDeleteComponent}
        />
      );
    }

    const shouldShowError = touchedFields[componentConfig.id] || errors[componentConfig.id];

    return (
      <component.components.Viewer
        key={componentConfig.id}
        id={componentConfig.id}
        config={componentConfig.config}
        value={values[componentConfig.id]}
        onChange={(value) => handleValueChange(componentConfig.id, value)}
        onBlur={() => handleBlur(componentConfig.id)}
        error={shouldShowError ? errors[componentConfig.id] : undefined}
      />
    );
  };

  // Ensure config and components are properly initialized
  const components = config?.components || [];
  const isEmpty = components.length === 0;

  return (
    <VariablesProvider value={variablesContext}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex justify-between items-center mb-4">
          {mode === 'editor' && config.id && (
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
            mode === 'editor' && 'border-primary/20',
            isOver && 'border-primary bg-primary/5'
          )}
        >
          {isEmpty ? (
            <div className="text-center text-muted-foreground">
              Drag and drop components here
            </div>
          ) : mode === 'editor' ? (
            <SortableContext items={components.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {components.map(renderComponent)}
            </SortableContext>
          ) : (
            <>
              {components.map(renderComponent)}
              <div className="flex justify-end">
                <Button type="submit">Submit</Button>
              </div>
            </>
          )}
        </div>
      </form>

      {mode === 'editor' && config.id && (
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