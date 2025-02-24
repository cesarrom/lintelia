'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FormComponentProps } from '../types';

export function BaseProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  return (
    <div className="space-y-4">
      {/* Field Name */}
      <div className="space-y-2">
        <Label>Field Name</Label>
        <Input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
        />
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label>Label</Label>
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={field.description || ''}
          onChange={(e) => onChange({ ...field, description: e.target.value })}
        />
      </div>

      {/* Placeholder */}
      <div className="space-y-2">
        <Label>Placeholder</Label>
        <Input
          value={field.placeholder || ''}
          onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
        />
      </div>

      {/* Required */}
      <div className="flex items-center justify-between">
        <Label>Required</Label>
        <Switch
          checked={field.required || false}
          onCheckedChange={(checked) => onChange({ ...field, required: checked })}
        />
      </div>

      {/* Hidden */}
      <div className="flex items-center justify-between">
        <Label>Hidden</Label>
        <Switch
          checked={field.hidden || false}
          onCheckedChange={(checked) => onChange({ ...field, hidden: checked })}
        />
      </div>

      {/* Disabled */}
      <div className="flex items-center justify-between">
        <Label>Disabled</Label>
        <Switch
          checked={field.disabled || false}
          onCheckedChange={(checked) => onChange({ ...field, disabled: checked })}
        />
      </div>
    </div>
  );
} 