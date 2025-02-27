'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { RangeConfig } from './schema';

export function RangeEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<RangeConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="space-y-2">
        <Slider
          disabled
          value={[config.defaultValue ?? config.min]}
          min={config.min}
          max={config.max}
          step={config.step}
          className="cursor-not-allowed"
        />
        {config.showValue && (
          <div className="text-center text-sm text-muted-foreground">
            {config.defaultValue ?? config.min}
          </div>
        )}
      </div>
    </div>
  );
} 