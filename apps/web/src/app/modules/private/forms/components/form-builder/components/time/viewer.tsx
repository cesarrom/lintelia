'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { useController } from 'react-hook-form';
import { TimeConfig } from '@repo/fintivio/schemas';

export function TimeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<TimeConfig, string>) {
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
            minTime: (val) => {
              if (!config.min || !val) return true;
              return val >= config.min || `Time must be after ${config.min}`;
            },
            maxTime: (val) => {
              if (!config.max || !val) return true;
              return val <= config.max || `Time must be before ${config.max}`;
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
          type="time"
          {...controllerResult.field}
          placeholder={config.placeholder}
          className={controllerResult.fieldState.error ? 'border-destructive' : undefined}
          min={config.min}
          max={config.max}
          step={config.step}
          aria-invalid={!!controllerResult.fieldState.error}
          aria-describedby={controllerResult.fieldState.error ? `${id}-error` : undefined}
        />
      ) : (
        <Input
          id={id}
          name={config.propertyName}
          type="time"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={error ? 'border-destructive' : undefined}
          min={config.min}
          max={config.max}
          step={config.step}
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