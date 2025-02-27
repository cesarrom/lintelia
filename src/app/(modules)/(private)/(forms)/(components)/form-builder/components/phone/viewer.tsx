'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { PhoneConfig } from './schema';

function formatPhoneNumber(value: string, format: 'international' | 'national'): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  if (format === 'international') {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  } else {
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  }
}

export function PhoneViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<PhoneConfig, string>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    onChange?.(rawValue);
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
        {config.format === 'international' && (
          <Input
            type="text"
            value={`+1`}
            disabled
            className="bg-muted w-16"
          />
        )}
        <Input
          id={id}
          name={config.propertyName}
          type="tel"
          value={value ? formatPhoneNumber(value as string, config.format) : ''}
          onChange={handleChange}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={cn('flex-1', error ? 'border-destructive' : undefined)}
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