'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { CheckboxConfig } from './schema';

export function CheckboxViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<CheckboxConfig, boolean>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Checkbox
          id={id}
          name={config.propertyName}
          checked={value || false}
          onCheckedChange={onChange}
          onBlur={onBlur}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <Label htmlFor={id} className="text-sm font-normal">
          {config.text}
          {config.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 