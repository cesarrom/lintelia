'use client';

import { SlidersHorizontal } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface RangeConfig {
  min: number;
  max: number;
  step: number;
  showValue: boolean;
  showLimits: boolean;
  showTicks: boolean;
  tickCount: number;
}

const defaultConfig: RangeConfig = {
  min: 0,
  max: 100,
  step: 1,
  showValue: true,
  showLimits: true,
  showTicks: false,
  tickCount: 5
};

export function RangeCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config ? { ...defaultConfig, ...field.config as Partial<RangeConfig> } : defaultConfig;
  const value = field.defaultValue ? [Number(field.defaultValue)] : [config.min];

  return (
    <FieldWrapper
      field={field}
      icon={SlidersHorizontal}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="space-y-2">
        <div className="relative pt-6">
          <Slider
            value={value}
            min={config.min}
            max={config.max}
            step={config.step}
            className="w-full"
          />
          {config.showTicks && (
            <div className="absolute left-0 right-0 flex justify-between mt-2">
              {Array.from({ length: config.tickCount }).map((_, i) => (
                <div key={i} className="h-2 w-0.5 bg-border" />
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          {config.showLimits && (
            <>
              <span>{config.min}</span>
              <span>{config.max}</span>
            </>
          )}
        </div>
        {config.showValue && (
          <div className="text-center text-sm">
            Current value: {value[0]}
          </div>
        )}
      </div>
    </FieldWrapper>
  );
} 