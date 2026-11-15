'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { cn } from '@/lib/utils';
import { useController } from 'react-hook-form';
import { ColorConfig } from '@repo/fintivio/schemas';

export function ColorViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<ColorConfig, string>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || config.defaultValue || '#000000',
        rules: {
          required: config.required ? 'This field is required' : false,
          pattern: {
            value: /^#[0-9A-Fa-f]{6}$/,
            message: 'Must be a valid hex color'
          },
          ...(config.validation?.pattern ? {
            pattern: {
              value: new RegExp(config.validation.pattern),
              message: 'Invalid format'
            }
          } : {})
        }
      })
    : null;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && controllerResult?.fieldState.error
    ? controllerResult.fieldState.error.message 
    : error;

  const handleChange = (newValue: string) => {
    // Ensure the value is a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      if (isUsingReactHookForm && controllerResult) {
        controllerResult.field.onChange(newValue);
      } else if (onChange) {
        onChange(newValue);
      }
    }
  };

  const currentValue = isUsingReactHookForm && controllerResult 
    ? controllerResult.field.value 
    : (value || config.defaultValue || '#000000');

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="flex gap-2">
        <Input
          id={`${id}-picker`}
          name={`${config.propertyName}-picker`}
          type="color"
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={isUsingReactHookForm && controllerResult ? controllerResult.field.onBlur : onBlur}
          className="h-10 w-20 cursor-pointer"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          ref={isUsingReactHookForm && controllerResult ? controllerResult.field.ref : undefined}
        />
        <Input
          id={id}
          name={config.propertyName}
          type="text"
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={isUsingReactHookForm && controllerResult ? controllerResult.field.onBlur : onBlur}
          className={cn('flex-1', errorMessage && 'border-destructive')}
          placeholder="#000000"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
        />
      </div>
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 