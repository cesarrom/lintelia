'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface ColumnConfig {
  count: number;
  widths: string[];
  gap: number;
}

export function ColumnsProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = (field.config || {
    count: 2,
    widths: ['1fr', '1fr'],
    gap: 4
  }) as ColumnConfig;

  const updateConfig = (updates: Partial<ColumnConfig>) => {
    const newConfig = { ...config, ...updates };
    if (updates.count !== undefined) {
      // Adjust widths array when column count changes
      if (updates.count > config.count) {
        newConfig.widths = [...config.widths, ...Array(updates.count - config.count).fill('1fr')];
      } else {
        newConfig.widths = config.widths.slice(0, updates.count);
      }
    }
    onChange({ ...field, config: newConfig });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Columns-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Number of Columns</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateConfig({ count: Math.max(1, config.count - 1) })}
                disabled={config.count <= 1}
                className="h-8 w-8"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-4 text-center">{config.count}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => updateConfig({ count: Math.min(6, config.count + 1) })}
                disabled={config.count >= 6}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Column Widths</Label>
          <div className="grid gap-2">
            {config.widths.map((width, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={width}
                  onChange={(e) => {
                    const newWidths = [...config.widths];
                    newWidths[index] = e.target.value;
                    updateConfig({ widths: newWidths });
                  }}
                  placeholder="e.g., 1fr, 200px, 50%"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Use CSS grid values like fr units, pixels, or percentages
          </p>
        </div>

        <div className="space-y-2">
          <Label>Gap Size</Label>
          <Slider
            value={[config.gap]}
            onValueChange={([gap]) => updateConfig({ gap })}
            min={0}
            max={8}
            step={1}
            className="py-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>None</span>
            <span>Large</span>
          </div>
        </div>
      </div>
    </div>
  );
} 