'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function NumberProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const value = field.defaultValue as number;
  const config = field.config || {};

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Number-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Default Value</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={value || ''}
              min={config.min}
              max={config.max}
              step={config.step}
              onChange={(e) => onChange({
                ...field,
                defaultValue: e.target.value ? Number(e.target.value) : undefined
              })}
              className="w-full"
            />
            {value && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ ...field, defaultValue: undefined })}
                className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Min Value</Label>
            <Input
              type="number"
              value={config.min || ''}
              onChange={(e) => onChange({
                ...field,
                config: { ...config, min: e.target.value ? Number(e.target.value) : undefined }
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Value</Label>
            <Input
              type="number"
              value={config.max || ''}
              onChange={(e) => onChange({
                ...field,
                config: { ...config, max: e.target.value ? Number(e.target.value) : undefined }
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Step</Label>
            <Input
              type="number"
              value={config.step || ''}
              min="0"
              step="any"
              onChange={(e) => onChange({
                ...field,
                config: { ...config, step: e.target.value ? Number(e.target.value) : undefined }
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 