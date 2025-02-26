'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { sectionConfigSchema } from './schema';

export function SectionProperties({
  config,
  onChange,
}: PropertiesProps<typeof sectionConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({
      ...config,
      ...updates,
    });
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
        <Textarea
          value={config.description}
          onChange={(e) => updateConfig({ description: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Required</Label>
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig({ required: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Border</Label>
        <Switch
          checked={config.showBorder}
          onCheckedChange={(checked) => updateConfig({ showBorder: checked })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Collapsible</Label>
        <Switch
          checked={config.collapsible}
          onCheckedChange={(checked) => updateConfig({ collapsible: checked })}
        />
      </div>

      {config.collapsible && (
        <div className="flex items-center justify-between">
          <Label>Default Collapsed</Label>
          <Switch
            checked={config.defaultCollapsed}
            onCheckedChange={(checked) => updateConfig({ defaultCollapsed: checked })}
          />
        </div>
      )}
    </div>
  );
} 