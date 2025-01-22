'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

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

export function RangeProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config ? { ...defaultConfig, ...field.config as Partial<RangeConfig> } : defaultConfig;

  const updateConfig = (updates: Partial<RangeConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Range-specific properties */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min">Min Value</Label>
            <Input
              id="min"
              type="number"
              value={config.min}
              onChange={(e) => updateConfig({ min: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Max Value</Label>
            <Input
              id="max"
              type="number"
              value={config.max}
              onChange={(e) => updateConfig({ max: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="step">Step</Label>
            <Input
              id="step"
              type="number"
              min={0}
              step={0.1}
              value={config.step}
              onChange={(e) => updateConfig({ step: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showValue">Show Current Value</Label>
            <Switch
              id="showValue"
              checked={config.showValue}
              onCheckedChange={(checked) => updateConfig({ showValue: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="showLimits">Show Min/Max Labels</Label>
            <Switch
              id="showLimits"
              checked={config.showLimits}
              onCheckedChange={(checked) => updateConfig({ showLimits: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="showTicks">Show Tick Marks</Label>
            <Switch
              id="showTicks"
              checked={config.showTicks}
              onCheckedChange={(checked) => updateConfig({ showTicks: checked })}
            />
          </div>

          {config.showTicks && (
            <div className="space-y-2">
              <Label htmlFor="tickCount">Number of Ticks</Label>
              <Slider
                value={[config.tickCount]}
                onValueChange={([value]) => updateConfig({ tickCount: value })}
                min={2}
                max={10}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>2</span>
                <span>10</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 