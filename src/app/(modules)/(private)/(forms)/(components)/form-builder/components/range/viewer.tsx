'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ViewerProps } from '../../types';
import { rangeConfigSchema, rangeInputSchema, rangeOutputSchema } from './schema';

export function RangeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof rangeConfigSchema, typeof rangeInputSchema, typeof rangeOutputSchema>) {
  const currentValue = typeof value === 'number' ? value : config.min;
  const formattedValue = [
    config.valuePrefix,
    currentValue,
    config.valueSuffix,
  ].filter(Boolean).join('');

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="space-y-4">
        <Slider
          id={id}
          value={[currentValue]}
          min={config.min}
          max={config.max}
          step={config.step}
          onValueChange={([value]) => onChange?.(value)}
          onValueCommit={() => onBlur?.()}
        />
        {config.showValue && (
          <div className="text-sm text-center">
            {formattedValue}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 