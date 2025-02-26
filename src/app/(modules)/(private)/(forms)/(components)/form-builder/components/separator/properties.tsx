'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { separatorConfigSchema } from './schema';

export function SeparatorProperties({
  config,
  onChange,
}: PropertiesProps<typeof separatorConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showLabel}
          onCheckedChange={(checked) => updateConfig({ showLabel: checked })}
        />
        <Label>Show Label</Label>
      </div>

      {config.showLabel && (
        <>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={config.label}
              onChange={(e) => updateConfig({ label: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={config.description || ''}
              onChange={(e) => updateConfig({ description: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
} 