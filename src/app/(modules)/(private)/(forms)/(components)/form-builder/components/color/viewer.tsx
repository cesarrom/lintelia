'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { colorConfigSchema, colorInputSchema, colorOutputSchema } from './schema';

export function ColorViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof colorConfigSchema, typeof colorInputSchema, typeof colorOutputSchema>) {
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
          type="color"
          value={value || config.defaultValue || '#000000'}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onBlur}
          className="h-10 w-20 cursor-pointer"
        />
        <Input
          id={id}
          type="text"
          value={value || config.defaultValue || '#000000'}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onBlur}
          className={error ? 'border-destructive flex-1' : 'flex-1'}
          placeholder="#000000"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 