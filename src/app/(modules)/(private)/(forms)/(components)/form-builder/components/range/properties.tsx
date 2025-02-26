'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PropertiesProps } from '../../types';
import { rangeConfigSchema } from './schema';

export function RangeProperties({
  config,
  onChange,
}: PropertiesProps<typeof rangeConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange?.({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => updateConfig({ label: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={config.description}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Required</Label>
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig({ required: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>Minimum Value</Label>
        <Input
          type="number"
          value={config.min}
          onChange={(e) => updateConfig({ min: Number(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Maximum Value</Label>
        <Input
          type="number"
          value={config.max}
          onChange={(e) => updateConfig({ max: Number(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Step</Label>
        <Input
          type="number"
          value={config.step}
          onChange={(e) => updateConfig({ step: Number(e.target.value) })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Value</Label>
        <Switch
          checked={config.showValue}
          onCheckedChange={(checked) => updateConfig({ showValue: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>Value Prefix</Label>
        <Input
          value={config.valuePrefix}
          onChange={(e) => updateConfig({ valuePrefix: e.target.value })}
          placeholder="e.g. $"
        />
      </div>

      <div className="space-y-2">
        <Label>Value Suffix</Label>
        <Input
          value={config.valueSuffix}
          onChange={(e) => updateConfig({ valueSuffix: e.target.value })}
          placeholder="e.g. kg"
        />
      </div>
    </div>
  );
} 