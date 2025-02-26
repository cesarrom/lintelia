'use client';

import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { datetimeConfigSchema, datetimeInputSchema, datetimeOutputSchema } from './schema';
import { cn } from '@/lib/utils';

export function DateTimeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof datetimeConfigSchema, typeof datetimeInputSchema, typeof datetimeOutputSchema>) {
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    const time = value ? value.split('T')[1] : '00:00';
    updateDateTime(date, time);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    const date = value ? value.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
    updateDateTime(date, time);
  };

  const updateDateTime = (date: string, time: string) => {
    if (!date || !time) {
      onChange?.('');
      return;
    }

    const datetime = `${date}T${time}`;
    const dateObj = parseISO(datetime);
    const now = new Date();

    if (config.minDateTime && isBefore(dateObj, parseISO(config.minDateTime))) {
      return;
    }

    if (config.maxDateTime && isAfter(dateObj, parseISO(config.maxDateTime))) {
      return;
    }

    if (config.disablePastDateTime && isBefore(dateObj, now)) {
      return;
    }

    if (config.disableFutureDateTime && isAfter(dateObj, now)) {
      return;
    }

    onChange?.(datetime);
  };

  const dateValue = value ? value.split('T')[0] : '';
  const timeValue = value ? value.split('T')[1] : '';

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
          id={`${id}-date`}
          type="date"
          value={dateValue}
          onChange={handleDateChange}
          onBlur={onBlur}
          min={config.minDateTime?.split('T')[0]}
          max={config.maxDateTime?.split('T')[0]}
          className={error ? 'border-destructive' : undefined}
        />
        <Input
          id={`${id}-time`}
          type="time"
          value={timeValue}
          onChange={handleTimeChange}
          onBlur={onBlur}
          step={config.showSeconds ? 1 : 60}
          className={cn('w-32', error && 'border-destructive')}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 