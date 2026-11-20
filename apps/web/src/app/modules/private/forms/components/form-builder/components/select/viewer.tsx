'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { SelectConfig, OptionsSource } from '@repo/lintelia/schemas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';

export function SelectViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<SelectConfig, string>) {
  const { variables } = useVariables();

  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || '',
        rules: {
          required: config.required ? 'This field is required' : false
        }
      })
    : null;
  
  const field = controllerResult?.field || {} as Partial<ControllerRenderProps>;
  const fieldState = controllerResult?.fieldState || {} as Partial<ControllerFieldState>;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && fieldState.error
    ? fieldState.error.message 
    : error;

  // Get options based on source type
  const options = useMemo(() => {
    const source = config.source as OptionsSource;
    
    if (source.type === 'static') {
      return source.options;
    }

    // Handle variable source
    if (source.type === 'variable') {
      const variableValue = variables[source.variableName];
      if (!Array.isArray(variableValue)) return [];

      return variableValue.map((item: any) => ({
        id: nanoid(),
        label: source.labelPath ? get(item, source.labelPath) : item.toString(),
        value: source.valuePath ? get(item, source.valuePath) : item.toString(),
      }));
    }

    return [];
  }, [config.source, variables]);

  const handleChange = (newValue: string) => {
    if (isUsingReactHookForm && field.onChange) {
      field.onChange(newValue);
      if (field.onBlur) field.onBlur();
    } else if (onChange) {
      onChange(newValue);
      if (onBlur) onBlur();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <Select
        value={isUsingReactHookForm && field.value !== undefined ? field.value : (value || '')}
        onValueChange={handleChange}
      >
        <SelectTrigger
          id={id}
          name={config.propertyName}
          className={cn(errorMessage ? 'border-destructive' : undefined)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          {...(isUsingReactHookForm && field.ref ? { ref: field.ref } : {})}
        >
          <SelectValue placeholder={config.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.label} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 