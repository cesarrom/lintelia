'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextConfig } from './schema';
import { ViewerProps } from '../../schemas';

export function TextViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<TextConfig, string>) {
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
        type="text"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        className={error ? 'border-destructive' : undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 