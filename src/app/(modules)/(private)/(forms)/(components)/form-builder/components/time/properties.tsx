'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { timeConfigSchema } from './schema';

export function TimeProperties({
  config,
  onChange,
}: PropertiesProps<typeof timeConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
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
        <Label>Placeholder</Label>
        <Input
          value={config.placeholder || ''}
          onChange={(e) => updateConfig({ placeholder: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Minimum Time (HH:mm)</Label>
        <Input
          type="time"
          value={config.min || ''}
          onChange={(e) => updateConfig({ min: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Maximum Time (HH:mm)</Label>
        <Input
          type="time"
          value={config.max || ''}
          onChange={(e) => updateConfig({ max: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Time Step (seconds)</Label>
        <Input
          type="number"
          value={config.step || 60}
          onChange={(e) => updateConfig({ step: parseInt(e.target.value) })}
          min={1}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig({ required: checked })}
        />
        <Label>Required</Label>
      </div>
    </div>
  );
} 