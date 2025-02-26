'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { textareaConfigSchema } from './schema';

export function TextareaProperties({
  config,
  onChange,
}: PropertiesProps<typeof textareaConfigSchema>) {
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
        <Label>Number of Rows</Label>
        <Input
          type="number"
          min={2}
          value={config.rows}
          onChange={(e) => updateConfig({ rows: parseInt(e.target.value) || 2 })}
        />
      </div>

      <div className="space-y-2">
        <Label>Minimum Length</Label>
        <Input
          type="number"
          min={0}
          value={config.minLength || ''}
          onChange={(e) => {
            const value = e.target.value ? parseInt(e.target.value) : undefined;
            updateConfig({ minLength: value });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Maximum Length</Label>
        <Input
          type="number"
          min={0}
          value={config.maxLength || ''}
          onChange={(e) => {
            const value = e.target.value ? parseInt(e.target.value) : undefined;
            updateConfig({ maxLength: value });
          }}
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
          checked={config.resizable}
          onCheckedChange={(checked) => updateConfig({ resizable: checked })}
        />
        <Label>Allow Resize</Label>
      </div>
    </div>
  );
} 