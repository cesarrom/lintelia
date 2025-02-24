'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface DateTimeConfig {
  showDate: boolean;
  showTime: boolean;
  defaultValue?: string;
  format: string;
}

export function DateTimeProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = (field.config || {
    showDate: true,
    showTime: true,
    format: 'yyyy-MM-dd HH:mm:ss'
  }) as DateTimeConfig;

  const updateConfig = (updates: Partial<DateTimeConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* DateTime-specific properties */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="showDate">Show Date</Label>
          <Switch
            id="showDate"
            checked={config.showDate}
            onCheckedChange={(checked) => updateConfig({ showDate: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showTime">Show Time</Label>
          <Switch
            id="showTime"
            checked={config.showTime}
            onCheckedChange={(checked) => updateConfig({ showTime: checked })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="format">Date Format</Label>
          <Input
            id="format"
            value={config.format}
            onChange={(e) => updateConfig({ format: e.target.value })}
            placeholder="yyyy-MM-dd HH:mm:ss"
          />
          <p className="text-xs text-muted-foreground">
            Use date-fns format strings (e.g., yyyy-MM-dd HH:mm:ss)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultValue">Default Value</Label>
          <Input
            id="defaultValue"
            type="datetime-local"
            value={config.defaultValue}
            onChange={(e) => updateConfig({ defaultValue: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
} 