'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { useController, ControllerFieldState } from 'react-hook-form';
import { PasswordConfig } from '@repo/fintivio/schemas';

export function PasswordViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<PasswordConfig, string>) {
  const [showPassword, setShowPassword] = useState(false);
  
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
      <div className="relative">
        {isUsingReactHookForm ? (
          <Input
            id={id}
            {...field}
            type={showPassword ? 'text' : 'password'}
            placeholder={config.placeholder}
            className={cn(
              config.showToggle && 'pr-10',
              fieldState.error && 'border-destructive'
            )}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
          />
        ) : (
          <Input
            id={id}
            name={config.propertyName}
            type={showPassword ? 'text' : 'password'}
            value={value || ''}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            placeholder={config.placeholder}
            className={cn(
              config.showToggle && 'pr-10',
              error && 'border-destructive'
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        )}
        {config.showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="sr-only">
              {showPassword ? 'Hide password' : 'Show password'}
            </span>
          </Button>
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