'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { pageSeparatorConfigSchema } from './schema';

export function PageSeparatorProperties({
  config,
  onChange,
}: PropertiesProps<typeof pageSeparatorConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title</Label>
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

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showTitle}
          onCheckedChange={(checked) => updateConfig({ showTitle: checked })}
        />
        <Label>Show Title</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showPageNumber}
          onCheckedChange={(checked) => updateConfig({ showPageNumber: checked })}
        />
        <Label>Show Page Number</Label>
      </div>
    </div>
  );
} 