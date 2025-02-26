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
import { numberConfigSchema } from './schema';

export function NumberProperties({
  config,
  onChange,
}: PropertiesProps<typeof numberConfigSchema>) {
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
        <Select
          value={config.format}
          onValueChange={(value) => updateConfig({ format: value as typeof config.format })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="decimal">Decimal</SelectItem>
            <SelectItem value="integer">Integer</SelectItem>
            <SelectItem value="currency">Currency</SelectItem>
            <SelectItem value="percentage">Percentage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {config.format === 'currency' && (
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={config.currency}
            onValueChange={(value) => updateConfig({ currency: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD ($)</SelectItem>
              <SelectItem value="EUR">EUR (€)</SelectItem>
              <SelectItem value="GBP">GBP (£)</SelectItem>
              <SelectItem value="JPY">JPY (¥)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Precision (Decimal Places)</Label>
        <Input
          type="number"
          min={0}
          max={10}
          value={config.precision}
          onChange={(e) => updateConfig({ precision: parseInt(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Step</Label>
        <Input
          type="number"
          min={0}
          step="any"
          value={config.step}
          onChange={(e) => updateConfig({ step: parseFloat(e.target.value) })}
        />
      </div>

      <div className="space-y-2">
        <Label>Minimum Value</Label>
        <Input
          type="number"
          step="any"
          value={config.minValue || ''}
          onChange={(e) => {
            const value = e.target.value ? parseFloat(e.target.value) : undefined;
            updateConfig({ minValue: value });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Maximum Value</Label>
        <Input
          type="number"
          step="any"
          value={config.maxValue || ''}
          onChange={(e) => {
            const value = e.target.value ? parseFloat(e.target.value) : undefined;
            updateConfig({ maxValue: value });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>Prefix</Label>
        <Input
          value={config.prefix || ''}
          onChange={(e) => updateConfig({ prefix: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-2">
        <Label>Suffix</Label>
        <Input
          value={config.suffix || ''}
          onChange={(e) => updateConfig({ suffix: e.target.value || undefined })}
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
          checked={config.allowNegative}
          onCheckedChange={(checked) => updateConfig({ allowNegative: checked })}
        />
        <Label>Allow Negative Numbers</Label>
      </div>
    </div>
  );
} 