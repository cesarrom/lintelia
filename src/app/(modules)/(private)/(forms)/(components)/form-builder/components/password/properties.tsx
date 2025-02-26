'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { passwordConfigSchema } from './schema';

export function PasswordProperties({
  config,
  onChange,
}: PropertiesProps<typeof passwordConfigSchema>) {
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

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.required}
          onCheckedChange={(checked) => updateConfig({ required: checked })}
        />
        <Label>Required</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={config.showStrengthIndicator}
          onCheckedChange={(checked) => updateConfig({ showStrengthIndicator: checked })}
        />
        <Label>Show Strength Indicator</Label>
      </div>

      <div className="space-y-2">
        <Label>Minimum Length</Label>
        <Input
          type="number"
          min={1}
          value={config.minLength}
          onChange={(e) => updateConfig({ minLength: parseInt(e.target.value) || 1 })}
        />
      </div>

      <div className="space-y-4">
        <Label className="block">Password Requirements</Label>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.requireNumbers}
              onCheckedChange={(checked) => updateConfig({ requireNumbers: checked })}
            />
            <Label>Require Numbers</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={config.requireLetters}
              onCheckedChange={(checked) => updateConfig({ requireLetters: checked })}
            />
            <Label>Require Letters</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={config.requireSymbols}
              onCheckedChange={(checked) => updateConfig({ requireSymbols: checked })}
            />
            <Label>Require Symbols</Label>
          </div>
        </div>
      </div>
    </div>
  );
} 