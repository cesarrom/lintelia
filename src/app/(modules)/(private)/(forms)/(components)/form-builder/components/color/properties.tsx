'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PropertiesProps } from '../../types';
import { colorConfigSchema } from './schema';

export function ColorProperties({
  config,
  onChange,
}: PropertiesProps<typeof colorConfigSchema>) {
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
        <Label>Description</Label>
        <Input
          value={config.description || ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Default Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={config.defaultValue || '#000000'}
            onChange={(e) => updateConfig({ defaultValue: e.target.value })}
            className="h-10 w-20 cursor-pointer"
          />
          <Input
            type="text"
            value={config.defaultValue || '#000000'}
            onChange={(e) => {
              if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                updateConfig({ defaultValue: e.target.value });
              }
            }}
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <Select
          value={config.format}
          onValueChange={(value) => updateConfig({ format: value as 'hex' | 'rgb' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hex">Hex (#RRGGBB)</SelectItem>
            <SelectItem value="rgb">RGB (r,g,b)</SelectItem>
          </SelectContent>
        </Select>
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