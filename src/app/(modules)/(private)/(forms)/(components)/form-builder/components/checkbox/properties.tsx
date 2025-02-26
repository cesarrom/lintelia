'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { checkboxConfigSchema } from './schema';

export function CheckboxProperties({
  config,
  onChange,
}: PropertiesProps<typeof checkboxConfigSchema>) {
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
        <Label>Checkbox Text</Label>
        <Input
          value={config.text}
          onChange={(e) => updateConfig({ text: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig({ required: checked })}
        />
        <Label>Required</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.defaultChecked}
          onCheckedChange={(checked) => updateConfig({ defaultChecked: checked })}
        />
        <Label>Default Checked</Label>
      </div>
    </div>
  );
} 