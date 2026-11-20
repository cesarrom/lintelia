'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { cn } from '@/lib/utils';
import { useController } from 'react-hook-form';
import { PhoneConfig } from '@repo/lintelia/schemas';

// Helper function to format phone number
function formatPhoneNumber(value: string, format: 'international' | 'national'): string {
  if (!value) return '';
  
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  if (format === 'international') {
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  } else { // national
    if (digits.length <= 3) {
      return `(${digits}`;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  }
}

export function PhoneViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<PhoneConfig, string>) {
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
            validPhone: (val) => {
              if (!val && !config.required) return true;
              if (!val) return 'Phone number is required';
              // Basic validation - at least 10 digits
              const digits = val.replace(/\D/g, '');
              return digits.length >= 10 || 'Please enter a valid phone number';
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
    const rawValue = e.target.value.replace(/\D/g, '');
    
    if (isUsingReactHookForm && controllerResult) {
      controllerResult.field.onChange(rawValue);
    } else if (onChange) {
      onChange(rawValue);
    }
  };

  const displayValue = isUsingReactHookForm && controllerResult
    ? formatPhoneNumber(controllerResult.field.value as string, config.format)
    : (value ? formatPhoneNumber(value as string, config.format) : '');

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
        {config.format === 'international' && (
          <Input
            type="text"
            value={`+1`}
            disabled
            className="bg-muted w-16"
          />
        )}
        <Input
          id={id}
          name={config.propertyName}
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={isUsingReactHookForm && controllerResult ? controllerResult.field.onBlur : onBlur}
          placeholder={config.placeholder}
          className={cn('flex-1', errorMessage ? 'border-destructive' : undefined)}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          ref={isUsingReactHookForm && controllerResult ? controllerResult.field.ref : undefined}
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