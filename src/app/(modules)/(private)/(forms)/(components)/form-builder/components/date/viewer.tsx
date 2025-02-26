'use client';

import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { dateConfigSchema, dateInputSchema, dateOutputSchema } from './schema';

export function DateViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof dateConfigSchema, typeof dateInputSchema, typeof dateOutputSchema>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    if (!date) {
      onChange?.('');
      return;
    }

    // Validate date constraints
    const dateObj = parseISO(date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (config.minDate && isBefore(dateObj, parseISO(config.minDate))) {
      return;
    }

    if (config.maxDate && isAfter(dateObj, parseISO(config.maxDate))) {
      return;
    }

    if (config.disablePastDates && isBefore(dateObj, now)) {
      return;
    }

    if (config.disableFutureDates && isAfter(dateObj, now)) {
      return;
    }

    onChange?.(date);
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
        type="date"
        value={value || ''}
        onChange={handleChange}
        onBlur={onBlur}
        min={config.minDate}
        max={config.maxDate}
        placeholder={config.placeholder}
        className={error ? 'border-destructive' : undefined}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 