'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { RadioConfig } from './schema';
import { ViewerProps } from '../../schemas';

export function RadioViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<RadioConfig, string>) {
  return (
    <div className="space-y-2">
      <Label className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <RadioGroup
        className={cn(
          config.layout === 'horizontal' ? 'flex gap-4' : 'space-y-2',
          error && 'text-destructive'
        )}
        value={value || config.defaultValue || ''}
        onValueChange={onChange}
        onBlur={onBlur}
        name={config.propertyName}
      >
        {config.options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={option.value}
              id={`${id}-${option.value}`}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 