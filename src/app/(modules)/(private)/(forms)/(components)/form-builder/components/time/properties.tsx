'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TimeProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const time = field.defaultValue as string;

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Time-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Default Time</Label>
          <div className="flex gap-2">
            <Input
              type="time"
              value={time || ''}
              onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
              className="w-full"
            />
            {time && (
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
      </div>
    </div>
  );
} 