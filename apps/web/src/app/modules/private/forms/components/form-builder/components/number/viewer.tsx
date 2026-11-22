'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { useController } from 'react-hook-form';
import { NumberConfig } from '@repo/lintelia/schemas';

export function NumberViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<NumberConfig, number>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value,
        rules: {
          required: config.required ? 'This field is required' : false,
          min: config.validation?.min !== undefined 
            ? { value: config.validation.min, message: `Minimum value is ${config.validation.min}` }
            : undefined,
          max: config.validation?.max !== undefined
            ? { value: config.validation.max, message: `Maximum value is ${config.validation.max}` }
            : undefined,
          validate: {
            isNumber: (val) => {
              if (val === '' || val === undefined) return !config.required || 'This field is required';
              return !isNaN(Number(val)) || 'Must be a valid number';
            },
            precision: (val) => {
              if (val === '' || val === undefined || config.validation?.precision === undefined) return true;
              const numVal = Number(val);
              const decimalPlaces = (numVal.toString().split('.')[1] || '').length;
              return decimalPlaces <= config.validation.precision || 
                `Maximum ${config.validation.precision} decimal places allowed`;
            }
          }
        }
      })
    : null;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && controllerResult?.fieldState.error
    ? controllerResult.fieldState.error.message 
    : error;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value === '' ? undefined : parseFloat(e.target.value);
    
    if (isUsingReactHookForm && controllerResult) {
      // Store numbers (the values schema expects a number), keep '' while the field is empty.
      controllerResult.field.onChange(newValue === undefined || Number.isNaN(newValue) ? undefined : newValue);
    } else if (onChange) {
      onChange(newValue as number);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      
      <Input
        id={id}
        name={config.propertyName}
        type="number"
        value={isUsingReactHookForm && controllerResult
          ? (controllerResult.field.value ?? '')
          : (value !== undefined ? value : '')}
        onChange={handleChange}
        onBlur={isUsingReactHookForm && controllerResult ? controllerResult.field.onBlur : onBlur}
        placeholder={config.placeholder}
        className={errorMessage ? 'border-destructive' : undefined}
        min={config.validation?.min}
        max={config.validation?.max}
        step={config.validation?.step}
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? `${id}-error` : undefined}
        ref={isUsingReactHookForm && controllerResult ? controllerResult.field.ref : undefined}
      />
      
      {errorMessage && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
} 