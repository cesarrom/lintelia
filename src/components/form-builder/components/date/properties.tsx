'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DateProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const date = field.defaultValue ? new Date(field.defaultValue as string) : undefined;

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Date-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Default Date</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : 'Pick a date'}
            </Button>
            {date && (
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
          <div className="rounded-lg border">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date) => onChange({ ...field, defaultValue: date?.toISOString() })}
              initialFocus
            />
          </div>
        </div>
      </div>
    </div>
  );
} 