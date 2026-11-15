'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextConfig } from '@repo/fintivio/schemas';
import { ViewerProps } from '../../schemas';
import { useController, ControllerFieldState } from 'react-hook-form';

export function TextViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<TextConfig, string>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || '',
        rules: {
          required: config.required ? 'This field is required' : false,
          minLength: config.validation?.minLength 
            ? { value: config.validation.minLength, message: `Minimum length is ${config.validation.minLength} characters` }
            : undefined,
          maxLength: config.validation?.maxLength
            ? { value: config.validation.maxLength, message: `Maximum length is ${config.validation.maxLength} characters` }
            : undefined,
          pattern: config.validation?.pattern
            ? { value: new RegExp(config.validation.pattern), message: 'Invalid format' }
            : undefined
        }
      })
    : null;
  
  const field = controllerResult?.field || {};
  const fieldState = controllerResult?.fieldState || {} as ControllerFieldState;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && fieldState.error
    ? fieldState.error.message 
    : error;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      
      {isUsingReactHookForm ? (
        <Input
          id={id}
          {...field}
          type="text"
          placeholder={config.placeholder}
          className={fieldState.error ? 'border-destructive' : undefined}
          aria-invalid={!!fieldState.error}
          aria-describedby={fieldState.error ? `${id}-error` : undefined}
        />
      ) : (
        <Input
          id={id}
          name={config.propertyName}
          type="text"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={error ? 'border-destructive' : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}
      
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 