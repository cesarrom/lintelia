'use client';

import { useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PropertiesProps } from '../../types';
import { richtextConfigSchema } from './schema';

export function RichtextProperties({
  config,
  onChange,
}: PropertiesProps<typeof richtextConfigSchema>) {
  const handleChange = useCallback(
    (field: string) => (value: unknown) => {
      onChange({
        ...config,
        [field]: value,
      });
    },
    [config, onChange]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={config.label}
          onChange={(e) => handleChange('label')(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={config.description}
          onChange={(e) => handleChange('description')(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Placeholder</Label>
        <Input
          value={config.placeholder}
          onChange={(e) => handleChange('placeholder')(e.target.value)}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="required"
          checked={config.required}
          onCheckedChange={handleChange('required')}
        />
        <Label htmlFor="required">Required</Label>
      </div>
    </div>
  );
} 