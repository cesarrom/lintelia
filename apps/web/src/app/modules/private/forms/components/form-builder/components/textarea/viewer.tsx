'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { cn } from '@/lib/utils';
import { useController } from 'react-hook-form';
import { TextareaConfig } from '@repo/lintelia/schemas';

export function TextareaViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<TextareaConfig, string>) {
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

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && controllerResult?.fieldState.error
    ? controllerResult.fieldState.error.message 
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
      
      {isUsingReactHookForm && controllerResult ? (
        <Textarea
          id={id}
          {...controllerResult.field}
          placeholder={config.placeholder}
          rows={config.rows}
          className={cn(controllerResult.fieldState.error && 'border-destructive')}
          aria-invalid={!!controllerResult.fieldState.error}
          aria-describedby={controllerResult.fieldState.error ? `${id}-error` : undefined}
        />
      ) : (
        <Textarea
          id={id}
          name={config.propertyName}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder}
          rows={config.rows}
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