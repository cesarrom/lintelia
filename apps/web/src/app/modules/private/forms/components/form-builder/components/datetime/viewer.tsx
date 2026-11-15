'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { useController } from 'react-hook-form';
import { DatetimeConfig } from '@repo/fintivio/schemas';

export function DatetimeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<DatetimeConfig, string>) {
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
          validate: {
            minDate: (val) => {
              if (!config.validation?.min || !val) return true;
              return val >= config.validation.min || 
                `Must be after ${new Date(config.validation.min).toLocaleString()}`;
            },
            maxDate: (val) => {
              if (!config.validation?.max || !val) return true;
              return val <= config.validation.max || 
                `Must be before ${new Date(config.validation.max).toLocaleString()}`;
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
          type={config.format === 'time' ? 'time' : 'datetime-local'}
          {...controllerResult.field}
          placeholder={config.placeholder}
          className={cn(controllerResult.fieldState.error && 'border-destructive')}
          aria-invalid={!!controllerResult.fieldState.error}
          aria-describedby={controllerResult.fieldState.error ? `${id}-error` : undefined}
          min={config.validation?.min}
          max={config.validation?.max}
        />
      ) : (
        <Input
          id={id}
          name={config.propertyName}
          type={config.format === 'time' ? 'time' : 'datetime-local'}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={cn(error && 'border-destructive')}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          min={config.validation?.min}
          max={config.validation?.max}
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