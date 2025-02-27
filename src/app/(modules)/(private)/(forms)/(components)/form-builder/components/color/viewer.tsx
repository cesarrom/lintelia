'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorConfig } from './schema';
import { ViewerProps } from '../../schemas';
import { cn } from '@/lib/utils';

export function ColorViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<ColorConfig, string>) {
  const handleChange = (newValue: string) => {
    // Ensure the value is a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange?.(newValue);
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
      <div className="flex gap-2">
        <Input
          id={`${id}-picker`}
          name={`${config.propertyName}-picker`}
          type="color"
          value={value || config.defaultValue || '#000000'}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onBlur}
          className="h-10 w-20 cursor-pointer"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Input
          id={id}
          name={config.propertyName}
          type="text"
          value={value || config.defaultValue || '#000000'}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onBlur}
          className={cn('flex-1', error && 'border-destructive')}
          placeholder="#000000"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 