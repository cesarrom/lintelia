'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { RadioConfig } from './schema';
import { ViewerProps } from '../../schemas';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';

export function RadioViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<RadioConfig, string>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || config.defaultValue || '',
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

  // Handle value change
  const handleValueChange = (newValue: string) => {
    if (isUsingReactHookForm && field.onChange) {
      field.onChange(newValue);
      if (field.onBlur) field.onBlur();
    } else if (onChange) {
      onChange(newValue);
    }
  };

  // Handle blur
  const handleBlur = () => {
    if (isUsingReactHookForm && field.onBlur) {
      field.onBlur();
    } else if (onBlur) {
      onBlur();
    }
  };

  return (
    <div className="space-y-2">
      <Label className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <RadioGroup
        className={cn(
          config.layout === 'horizontal' ? 'flex gap-4' : 'space-y-2',
          errorMessage && 'text-destructive'
        )}
        value={isUsingReactHookForm && field.value !== undefined ? field.value : (value || config.defaultValue || '')}
        onValueChange={handleValueChange}
        onBlur={handleBlur}
        name={config.propertyName}
        ref={isUsingReactHookForm && field.ref ? field.ref : undefined}
      >
        {config.options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.value}
              id={`${id}-${option.value}`}
              aria-invalid={!!errorMessage}
              aria-describedby={errorMessage ? `${id}-error` : undefined}
            />
            <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 