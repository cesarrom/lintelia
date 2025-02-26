'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { ratingConfigSchema } from './schema';
import { Slider } from '@/components/ui/slider';

export function RatingProperties({
  config,
  onChange,
}: PropertiesProps<typeof ratingConfigSchema>) {
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
        <Label>Maximum Rating</Label>
        <Slider
          value={[config.maxRating]}
          onValueChange={([value]) => updateConfig({ maxRating: value })}
          min={1}
          max={10}
          step={1}
          className="py-2"
        />
        <p className="text-sm text-muted-foreground text-right">{config.maxRating} stars</p>
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
          checked={config.showLabels}
          onCheckedChange={(checked) => updateConfig({ showLabels: checked })}
        />
        <Label>Show Labels</Label>
      </div>

      {config.showLabels && (
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Low Rating Label</Label>
            <Input
              value={config.lowLabel}
              onChange={(e) => updateConfig({ lowLabel: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>High Rating Label</Label>
            <Input
              value={config.highLabel}
              onChange={(e) => updateConfig({ highLabel: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
} 