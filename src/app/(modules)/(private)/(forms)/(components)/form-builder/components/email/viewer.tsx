'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmailConfig } from './schema';
import { ViewerProps } from '../../schemas';
import { cn } from '@/lib/utils';
import { useController, ControllerFieldState } from 'react-hook-form';

export function EmailViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<EmailConfig, string>) {
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
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Invalid email address'
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
          type="email"
          placeholder={config.placeholder || 'Enter email address'}
          className={cn(fieldState.error && 'border-destructive')}
          aria-invalid={!!fieldState.error}
          aria-describedby={fieldState.error ? `${id}-error` : undefined}
        />
      ) : (
        <Input
          id={id}
          name={config.propertyName}
          type="email"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder || 'Enter email address'}
          className={cn(error && 'border-destructive')}
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