'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../types';
import { numberConfigSchema, numberInputSchema, numberOutputSchema } from './schema';

export function NumberViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof numberConfigSchema, typeof numberInputSchema, typeof numberOutputSchema>) {
  const formatNumber = useCallback((value: number) => {
    switch (config.format) {
      case 'currency':
        return new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: config.currency,
          minimumFractionDigits: config.precision,
          maximumFractionDigits: config.precision,
        }).format(value);
      case 'percentage':
        return new Intl.NumberFormat(undefined, {
          style: 'percent',
          minimumFractionDigits: config.precision,
          maximumFractionDigits: config.precision,
        }).format(value / 100);
      case 'decimal':
        return new Intl.NumberFormat(undefined, {
          minimumFractionDigits: config.precision,
          maximumFractionDigits: config.precision,
        }).format(value);
      case 'integer':
        return new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
    }
  }, [config.format, config.currency, config.precision]);

  const parseNumber = useCallback((value: string) => {
    // Remove currency symbols, spaces, and other non-numeric characters
    const cleaned = value.replace(/[^0-9.-]/g, '');
    let number = parseFloat(cleaned);

    // Handle percentage
    if (config.format === 'percentage') {
      number = number / 100;
    }

    // Handle precision
    if (config.format === 'integer') {
      number = Math.round(number);
    } else {
      const factor = Math.pow(10, config.precision);
      number = Math.round(number * factor) / factor;
    }

    // Handle constraints
    if (!config.allowNegative) {
      number = Math.max(0, number);
    }
    if (config.minValue !== undefined) {
      number = Math.max(config.minValue, number);
    }
    if (config.maxValue !== undefined) {
      number = Math.min(config.maxValue, number);
    }

    return number;
  }, [config.format, config.precision, config.allowNegative, config.minValue, config.maxValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) {
      onChange?.(undefined as any);
      return;
    }

    try {
      const number = parseNumber(value);
      if (!isNaN(number)) {
        onChange?.(number);
      }
    } catch (err) {
      // Invalid number, ignore
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Format the displayed value on blur
    if (value !== null && value !== undefined) {
      e.target.value = formatNumber(value);
    }
    onBlur?.();
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Show the raw number on focus
    if (value !== null && value !== undefined) {
      e.target.value = String(value);
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
      <div className="relative">
        {config.prefix && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            {config.prefix}
          </span>
        )}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value !== null && value !== undefined ? formatNumber(value) : ''}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={config.placeholder}
          step={config.step}
          min={config.minValue}
          max={config.maxValue}
          className={cn(
            error && 'border-destructive',
            config.prefix && 'pl-7',
            config.suffix && 'pr-7'
          )}
        />
        {config.suffix && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
            {config.suffix}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 