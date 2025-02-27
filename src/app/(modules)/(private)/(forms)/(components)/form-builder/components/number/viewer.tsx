'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { NumberConfig } from './schema';
import { ViewerProps } from '../../schemas';

export function NumberViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<NumberConfig, number>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value === '' ? undefined : parseFloat(e.target.value);
    onChange?.(newValue as number);
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
      <Input
        id={id}
        name={config.propertyName}
        type="number"
        value={value !== undefined ? value : ''}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={config.placeholder}
        className={error ? 'border-destructive' : undefined}
        min={config.validation?.min}
        max={config.validation?.max}
        step={config.validation?.step}
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