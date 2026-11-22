'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { CheckboxConfig } from './schema';
import { useController, ControllerFieldState } from 'react-hook-form';

export function CheckboxViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<CheckboxConfig, boolean>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || false,
        rules: {
          required: config.required ? 'This field is required' : false
        }
      })
    : null;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && controllerResult?.fieldState.error
    ? controllerResult.fieldState.error.message 
    : error;

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        {isUsingReactHookForm && controllerResult ? (
          <Checkbox
            id={id}
            checked={controllerResult.field.value}
            onCheckedChange={controllerResult.field.onChange}
            ref={controllerResult.field.ref}
            onBlur={controllerResult.field.onBlur}
            aria-invalid={!!controllerResult.fieldState.error}
            aria-describedby={controllerResult.fieldState.error ? `${id}-error` : undefined}
          />
        ) : (
          <Checkbox
            id={id}
            name={config.propertyName}
            checked={value || false}
            onCheckedChange={onChange}
            onBlur={onBlur}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        )}
        <Label htmlFor={id} className="text-sm font-normal">
          {config.text}
          {config.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 