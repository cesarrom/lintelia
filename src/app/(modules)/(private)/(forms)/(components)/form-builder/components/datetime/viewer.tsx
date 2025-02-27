'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DatetimeConfig } from './schema';
import { ViewerProps } from '../../schemas';

export function DatetimeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<DatetimeConfig, string>) {
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
        type={config.format === 'time' ? 'time' : 'datetime-local'}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        className={cn(error && 'border-destructive')}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        min={config.validation?.min}
        max={config.validation?.max}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 