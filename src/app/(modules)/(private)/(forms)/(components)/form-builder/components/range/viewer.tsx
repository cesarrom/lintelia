'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ViewerProps } from '../../schemas';
import { RangeConfig } from './schema';

export function RangeViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<RangeConfig, number>) {
  const handleChange = (values: number[]) => {
    onChange?.(values[0]);
  };

  const currentValue = typeof value === 'number' 
    ? value 
    : (config.defaultValue ?? config.min);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="space-y-2">
        <Slider
          id={id}
          name={config.propertyName}
          value={[currentValue]}
          min={config.min}
          max={config.max}
          step={config.step}
          onValueChange={handleChange}
          onValueCommit={() => onBlur?.()}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {config.showValue && (
          <div className="text-center text-sm">
            {currentValue}
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 