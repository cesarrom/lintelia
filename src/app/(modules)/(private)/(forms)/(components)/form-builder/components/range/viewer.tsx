'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ViewerProps } from '../../schemas';
import { RangeConfig } from './schema';
import { useController, ControllerFieldState } from 'react-hook-form';

export function RangeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<RangeConfig, number>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: typeof value === 'number' ? value : (config.defaultValue ?? config.min),
        rules: {
          required: config.required ? 'This field is required' : false,
          min: { value: config.min, message: `Minimum value is ${config.min}` },
          max: { value: config.max, message: `Maximum value is ${config.max}` }
        }
      })
    : null;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && controllerResult?.fieldState.error
    ? controllerResult.fieldState.error.message 
    : error;

  const handleChange = (values: number[]) => {
    if (isUsingReactHookForm && controllerResult) {
      controllerResult.field.onChange(values[0]);
    } else if (onChange) {
      onChange(values[0]);
    }
  };

  const handleValueCommit = () => {
    if (isUsingReactHookForm && controllerResult) {
      controllerResult.field.onBlur();
    } else if (onBlur) {
      onBlur();
    }
  };

  const currentValue = isUsingReactHookForm && controllerResult
    ? controllerResult.field.value
    : (typeof value === 'number' ? value : (config.defaultValue ?? config.min));

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="space-y-2">
        <Slider
          id={id}
          name={config.propertyName}
          value={[currentValue]}
          min={config.min}
          max={config.max}
          step={config.step}
          onValueChange={handleChange}
          onValueCommit={handleValueCommit}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          ref={isUsingReactHookForm && controllerResult ? controllerResult.field.ref : undefined}
        />
        {config.showValue && (
          <div className="text-center text-sm">
            {currentValue}
          </div>
        )}
      </div>
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 