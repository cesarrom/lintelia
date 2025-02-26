'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { datetimeConfigSchema } from './schema';
import { format } from 'date-fns';

export function DateTimeProperties({
  config,
  onChange,
}: PropertiesProps<typeof datetimeConfigSchema>) {
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
          placeholder="YYYY-MM-DD HH:mm"
        />
      </div>

      <div className="space-y-2">
        <Label>Min Date/Time</Label>
        <div className="flex gap-2">
          <Input
            type="date"
            value={config.minDateTime?.split('T')[0] || ''}
            onChange={(e) => {
              const date = e.target.value;
              const time = config.minDateTime?.split('T')[1] || '00:00';
              updateConfig({
                minDateTime: date ? `${date}T${time}` : undefined,
              });
            }}
          />
          <Input
            type="time"
            value={config.minDateTime?.split('T')[1] || ''}
            onChange={(e) => {
              const time = e.target.value;
              const date = config.minDateTime?.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
              updateConfig({
                minDateTime: time ? `${date}T${time}` : undefined,
              });
            }}
            step={config.showSeconds ? 1 : 60}
            className="w-32"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Max Date/Time</Label>
        <div className="flex gap-2">
          <Input
            type="date"
            value={config.maxDateTime?.split('T')[0] || ''}
            onChange={(e) => {
              const date = e.target.value;
              const time = config.maxDateTime?.split('T')[1] || '23:59';
              updateConfig({
                maxDateTime: date ? `${date}T${time}` : undefined,
              });
            }}
          />
          <Input
            type="time"
            value={config.maxDateTime?.split('T')[1] || ''}
            onChange={(e) => {
              const time = e.target.value;
              const date = config.maxDateTime?.split('T')[0] || format(new Date(), 'yyyy-MM-dd');
              updateConfig({
                maxDateTime: time ? `${date}T${time}` : undefined,
              });
            }}
            step={config.showSeconds ? 1 : 60}
            className="w-32"
          />
        </div>
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
          checked={config.disablePastDateTime}
          onCheckedChange={(checked) => updateConfig({ disablePastDateTime: checked })}
        />
        <Label>Disable Past Date/Time</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.disableFutureDateTime}
          onCheckedChange={(checked) => updateConfig({ disableFutureDateTime: checked })}
        />
        <Label>Disable Future Date/Time</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showSeconds}
          onCheckedChange={(checked) => updateConfig({ showSeconds: checked })}
        />
        <Label>Show Seconds</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.use24Hour}
          onCheckedChange={(checked) => updateConfig({ use24Hour: checked })}
        />
        <Label>Use 24-Hour Format</Label>
      </div>
    </div>
  );
} 