'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { checkboxConfigSchema, checkboxInputSchema, checkboxOutputSchema } from './schema';

export function CheckboxViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof checkboxConfigSchema, typeof checkboxInputSchema, typeof checkboxOutputSchema>) {
  return (
    <div className="space-y-2">
      {config.label && (
        <Label className="block">
          {config.label}
          {config.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="flex items-center space-x-2">
        <Checkbox
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked: boolean) => onChange?.(checked)}
          onBlur={onBlur}
        />
        <Label htmlFor={id} className="text-sm">
          {config.text}
        </Label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 