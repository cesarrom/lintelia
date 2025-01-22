'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface PhoneConfig {
  format: string;
  placeholder: string;
  countryCode: string;
  showCountryCode: boolean;
}

const defaultConfig: PhoneConfig = {
  format: '(###) ###-####',
  placeholder: 'Enter phone number',
  countryCode: '+1',
  showCountryCode: true
};

export function PhoneProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config ? { ...defaultConfig, ...field.config as Partial<PhoneConfig> } : defaultConfig;

  const updateConfig = (updates: Partial<PhoneConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Phone-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="format">Format Pattern</Label>
          <Input
            id="format"
            value={config.format}
            onChange={(e) => updateConfig({ format: e.target.value })}
            placeholder="(###) ###-####"
          />
          <p className="text-xs text-muted-foreground">
            Use # to represent a digit in the format pattern
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="placeholder">Placeholder</Label>
          <Input
            id="placeholder"
            value={config.placeholder}
            onChange={(e) => updateConfig({ placeholder: e.target.value })}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showCountryCode">Show Country Code</Label>
            <Switch
              id="showCountryCode"
              checked={config.showCountryCode}
              onCheckedChange={(checked) => updateConfig({ showCountryCode: checked })}
            />
          </div>

          {config.showCountryCode && (
            <div className="space-y-2">
              <Label htmlFor="countryCode">Country Code</Label>
              <Input
                id="countryCode"
                value={config.countryCode}
                onChange={(e) => updateConfig({ countryCode: e.target.value })}
                placeholder="+1"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 