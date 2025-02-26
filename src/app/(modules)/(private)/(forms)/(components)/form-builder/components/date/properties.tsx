'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { dateConfigSchema } from './schema';

export function DateProperties({
  config,
  onChange,
}: PropertiesProps<typeof dateConfigSchema>) {
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
        <Label>Format</Label>
        <Input
          value={config.format}
          onChange={(e) => updateConfig({ format: e.target.value })}
          placeholder="YYYY-MM-DD"
        />
      </div>

      <div className="space-y-2">
        <Label>Min Date</Label>
        <Input
          type="date"
          value={config.minDate || ''}
          onChange={(e) => updateConfig({ minDate: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-2">
        <Label>Max Date</Label>
        <Input
          type="date"
          value={config.maxDate || ''}
          onChange={(e) => updateConfig({ maxDate: e.target.value || undefined })}
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
          checked={config.disablePastDates}
          onCheckedChange={(checked) => updateConfig({ disablePastDates: checked })}
        />
        <Label>Disable Past Dates</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.disableFutureDates}
          onCheckedChange={(checked) => updateConfig({ disableFutureDates: checked })}
        />
        <Label>Disable Future Dates</Label>
      </div>
    </div>
  );
} 