'use client';

import { Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { numberConfigSchema } from './schema';

export function NumberEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof numberConfigSchema>) {
  const formatNumber = (value: number) => {
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
  };

  const placeholder = config.format === 'currency'
    ? formatNumber(0)
    : config.placeholder;

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Hash className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="relative">
        {config.prefix && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
            {config.prefix}
          </span>
        )}
        <Input
          type="text"
          placeholder={placeholder}
          disabled
          className={cn(
            'pointer-events-none bg-muted',
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
      <div className="mt-1 text-xs text-muted-foreground">
        {config.minValue !== undefined && `Min: ${formatNumber(config.minValue)} • `}
        {config.maxValue !== undefined && `Max: ${formatNumber(config.maxValue)} • `}
        {`Step: ${config.step}`}
      </div>
    </div>
  );
} 