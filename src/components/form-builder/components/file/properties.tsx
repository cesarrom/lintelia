'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export function FileProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config || {};

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* File-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Accepted File Types</Label>
          <Input
            value={config.accept || ''}
            onChange={(e) => onChange({
              ...field,
              config: { ...config, accept: e.target.value }
            })}
            placeholder=".pdf,.doc,.docx,image/*"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of file extensions or MIME types
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label>Allow Multiple Files</Label>
          <Switch
            checked={config.multiple || false}
            onCheckedChange={(checked) => onChange({
              ...field,
              config: { ...config, multiple: checked }
            })}
          />
        </div>
      </div>
    </div>
  );
} 