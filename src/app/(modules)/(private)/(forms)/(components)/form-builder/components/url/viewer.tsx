'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { UrlConfig } from './schema';
import { useController, ControllerFieldState, ControllerRenderProps } from 'react-hook-form';

export function UrlViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<UrlConfig, string>) {
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
            value: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
            message: 'Please enter a valid URL'
          }
        }
      })
    : null;
  
  const field = controllerResult?.field || {} as Partial<ControllerRenderProps>;
  const fieldState = controllerResult?.fieldState || {} as Partial<ControllerFieldState>;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && fieldState.error
    ? fieldState.error.message 
    : error;

  // Handle value change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    
    // If there's a prefix and the user is typing a URL with the same prefix, remove it
    const processedUrl = config.prefix && url.startsWith(config.prefix)
      ? url.slice(config.prefix.length)
      : url;
    
    if (isUsingReactHookForm && field.onChange) {
      field.onChange(processedUrl);
    } else if (onChange) {
      onChange(processedUrl);
    }
  };

  // Handle blur
  const handleBlur = () => {
    if (isUsingReactHookForm && field.onBlur) {
      field.onBlur();
    } else if (onBlur) {
      onBlur();
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
      <div className="flex">
        {config.prefix && (
          <div className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
            {config.prefix}
          </div>
        )}
        {isUsingReactHookForm ? (
          <Input
            id={id}
            name={config.propertyName}
            type="url"
            value={field.value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={config.placeholder}
            className={cn(
              fieldState.error ? 'border-destructive' : undefined,
              config.prefix && 'rounded-l-none'
            )}
            aria-invalid={!!fieldState.error}
            aria-describedby={fieldState.error ? `${id}-error` : undefined}
            ref={field.ref}
          />
        ) : (
          <Input
            id={id}
            name={config.propertyName}
            type="url"
            value={value || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={config.placeholder}
            className={cn(
              errorMessage ? 'border-destructive' : undefined,
              config.prefix && 'rounded-l-none'
            )}
            aria-invalid={!!errorMessage}
            aria-describedby={errorMessage ? `${id}-error` : undefined}
          />
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