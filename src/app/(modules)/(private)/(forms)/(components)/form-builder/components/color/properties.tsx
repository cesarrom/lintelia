'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function ColorProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const color = field.defaultValue as string || '#000000';

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Color-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Default Color</Label>
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                type="color"
                value={color}
                onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
                className="w-12 p-1 h-10"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange({ ...field, defaultValue: '#000000' })}
              className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 