'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export function CheckboxProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Checkbox-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Checkbox Text</Label>
          <Input
            value={field.placeholder || ''}
            onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
            placeholder="Text to display next to checkbox"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label>Default Checked</Label>
          <Switch
            checked={field.defaultValue as boolean || false}
            onCheckedChange={(checked) => onChange({ ...field, defaultValue: checked })}
          />
        </div>
      </div>
    </div>
  );
} 