'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PropertiesProps } from '../../types';
import { phoneConfigSchema } from './schema';

export function PhoneProperties({
  config,
  onChange,
}: PropertiesProps<typeof phoneConfigSchema>) {
  const updateConfig = <K extends keyof typeof config>(
    key: K,
    value: (typeof config)[K]
  ) => {
    onChange?.({
      ...config,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => updateConfig('label', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Placeholder</Label>
        <Input
          value={config.placeholder}
          onChange={(e) => updateConfig('placeholder', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description}
          onChange={(e) => updateConfig('description', e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Required</Label>
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig('required', checked)}
        />
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <Select
          value={config.format}
          onValueChange={(value) => updateConfig('format', value as 'international' | 'national')}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="international">International (+1 XXX-XXX-XXXX)</SelectItem>
            <SelectItem value="national">(XXX) XXX-XXXX</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
} 