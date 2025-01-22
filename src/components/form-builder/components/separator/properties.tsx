'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SeparatorConfig {
  showLabel: boolean;
  labelPosition: 'left' | 'center' | 'right';
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
}

export function SeparatorProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = (field.config || {
    showLabel: true,
    labelPosition: 'center',
    thickness: 1,
    style: 'solid'
  }) as SeparatorConfig;

  const updateConfig = (updates: Partial<SeparatorConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Separator-specific properties */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="showLabel">Show Label</Label>
          <Switch
            id="showLabel"
            checked={config.showLabel}
            onCheckedChange={(checked) => updateConfig({ showLabel: checked })}
          />
        </div>

        {config.showLabel && (
          <div className="space-y-2">
            <Label>Label Position</Label>
            <Select
              value={config.labelPosition}
              onValueChange={(value: 'left' | 'center' | 'right') =>
                updateConfig({ labelPosition: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Line Style</Label>
          <Select
            value={config.style}
            onValueChange={(value: 'solid' | 'dashed' | 'dotted') =>
              updateConfig({ style: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="thickness">Line Thickness</Label>
          <Input
            id="thickness"
            type="number"
            min={1}
            max={10}
            value={config.thickness}
            onChange={(e) => updateConfig({ thickness: parseInt(e.target.value, 10) })}
          />
        </div>
      </div>
    </div>
  );
} 