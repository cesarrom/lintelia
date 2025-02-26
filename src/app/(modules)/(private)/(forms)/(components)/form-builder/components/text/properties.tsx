'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { textConfigSchema } from './schema';

export function TextProperties({
  config,
  onChange,
}: PropertiesProps<typeof textConfigSchema>) {
  const updateConfig = (updates: Partial<typeof config>) => {
    onChange({ ...config, ...updates });
  };

  const getValidationValue = (type: 'minLength' | 'maxLength' | 'pattern') => {
    const value = config.validation?.find(v => v.type === type)?.value;
    return value !== undefined ? String(value) : '';
  };

  const updateValidation = (
    type: 'minLength' | 'maxLength' | 'pattern',
    value: string | number
  ) => {
    const validation = config.validation || [];
    const index = validation.findIndex(v => v.type === type);

    if (value) {
      const rule = {
        type,
        value,
        message: `${type === 'pattern' ? 'Invalid format' : `${type} is ${value} characters`}`,
      };

      if (index >= 0) {
        validation[index] = rule;
      } else {
        validation.push(rule);
      }
    } else if (index >= 0) {
      validation.splice(index, 1);
    }

    updateConfig({ validation });
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

      <div className="space-y-4">
        <Label className="block">Validation</Label>

        <div className="space-y-2">
          <Label className="text-sm">Min Length</Label>
          <Input
            type="number"
            value={getValidationValue('minLength')}
            onChange={(e) => updateValidation('minLength', parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Max Length</Label>
          <Input
            type="number"
            value={getValidationValue('maxLength')}
            onChange={(e) => updateValidation('maxLength', parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Pattern (Regex)</Label>
          <Input
            value={getValidationValue('pattern')}
            onChange={(e) => updateValidation('pattern', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
} 