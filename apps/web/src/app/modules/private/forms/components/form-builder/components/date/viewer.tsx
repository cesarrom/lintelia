'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { cn } from '@/lib/utils';
import { useController } from 'react-hook-form';
import { DateConfig } from '@repo/fintivio/schemas';

export function DateViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<DateConfig, string>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value || config.defaultValue || '',
        rules: {
          required: config.required ? 'This field is required' : false,
          validate: {
            minDate: (val) => {
              if (!config.validation?.minDate || !val) return true;
              return new Date(val) >= new Date(config.validation.minDate) || 
                `Date must be after ${new Date(config.validation.minDate).toLocaleDateString()}`;
            },
            maxDate: (val) => {
              if (!config.validation?.maxDate || !val) return true;
              return new Date(val) <= new Date(config.validation.maxDate) || 
                `Date must be before ${new Date(config.validation.maxDate).toLocaleDateString()}`;
            }
          }
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
        <Input
          id={id}
          type="date"
          {...controllerResult.field}
          placeholder={config.placeholder}
          className={cn(controllerResult.fieldState.error && 'border-destructive')}
          aria-invalid={!!controllerResult.fieldState.error}
          aria-describedby={controllerResult.fieldState.error ? `${id}-error` : undefined}
          min={config.validation?.minDate}
          max={config.validation?.maxDate}
        />
      ) : (
        <Input
          id={id}
          name={config.propertyName}
          type="date"
          value={value || config.defaultValue || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={cn(error && 'border-destructive')}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          min={config.validation?.minDate}
          max={config.validation?.maxDate}
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