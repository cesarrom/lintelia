'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { fileConfigSchema } from './schema';

export function FileProperties({
  config,
  onChange,
}: PropertiesProps<typeof fileConfigSchema>) {
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
        <Label>Accepted File Types</Label>
        <Input
          value={config.accept}
          onChange={(e) => updateConfig({ accept: e.target.value })}
          placeholder="image/*,.pdf,.doc"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated list of MIME types or file extensions (e.g., image/*,.pdf)
        </p>
      </div>

      <div className="space-y-2">
        <Label>Maximum Files</Label>
        <Input
          type="number"
          min={1}
          value={config.maxFiles}
          onChange={(e) => updateConfig({ maxFiles: parseInt(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Maximum File Size (bytes)</Label>
        <Input
          type="number"
          min={1}
          value={config.maxSize}
          onChange={(e) => updateConfig({ maxSize: parseInt(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground">
          Size in bytes (e.g., 5242880 for 5MB)
        </p>
      </div>

      <div className="space-y-2">
        <Label>Minimum File Size (bytes)</Label>
        <Input
          type="number"
          min={0}
          value={config.minSize}
          onChange={(e) => updateConfig({ minSize: parseInt(e.target.value) })}
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
          checked={config.allowMultiple}
          onCheckedChange={(checked) => updateConfig({ allowMultiple: checked })}
        />
        <Label>Allow Multiple Files</Label>
      </div>
    </div>
  );
} 