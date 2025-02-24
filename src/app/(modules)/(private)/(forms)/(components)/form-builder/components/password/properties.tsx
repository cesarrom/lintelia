'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface PasswordConfig {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  showStrengthMeter?: boolean;
  showToggleVisibility?: boolean;
}

const defaultConfig: PasswordConfig = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  showStrengthMeter: true,
  showToggleVisibility: true,
};

export function PasswordProperties({ field, onChange }: { field: { config?: Partial<PasswordConfig> }, onChange: (config: Partial<PasswordConfig>) => void }) {
  const config = { ...defaultConfig, ...field.config };

  const handleChange = (key: keyof PasswordConfig, value: PasswordConfig[keyof PasswordConfig]) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Minimum Length</Label>
        <Input
          type="number"
          value={config.minLength}
          onChange={(e) => handleChange('minLength', parseInt(e.target.value))}
          min={1}
          max={config.maxLength}
        />
      </div>
      <div className="grid gap-2">
        <Label>Maximum Length</Label>
        <Input
          type="number"
          value={config.maxLength}
          onChange={(e) => handleChange('maxLength', parseInt(e.target.value))}
          min={config.minLength}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Require Uppercase</Label>
        <Switch
          checked={config.requireUppercase}
          onCheckedChange={(checked) => handleChange('requireUppercase', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Require Lowercase</Label>
        <Switch
          checked={config.requireLowercase}
          onCheckedChange={(checked) => handleChange('requireLowercase', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Require Numbers</Label>
        <Switch
          checked={config.requireNumbers}
          onCheckedChange={(checked) => handleChange('requireNumbers', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Require Special Characters</Label>
        <Switch
          checked={config.requireSpecialChars}
          onCheckedChange={(checked) => handleChange('requireSpecialChars', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Strength Meter</Label>
        <Switch
          checked={config.showStrengthMeter}
          onCheckedChange={(checked) => handleChange('showStrengthMeter', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Toggle Visibility</Label>
        <Switch
          checked={config.showToggleVisibility}
          onCheckedChange={(checked) => handleChange('showToggleVisibility', checked)}
        />
      </div>
    </div>
  );
} 