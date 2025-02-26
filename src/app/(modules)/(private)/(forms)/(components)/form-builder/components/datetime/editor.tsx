'use client';

import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { datetimeConfigSchema } from './schema';

export function DateTimeEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof datetimeConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="date"
          disabled
          className="pointer-events-none bg-muted"
        />
        <Input
          type="time"
          disabled
          className="pointer-events-none bg-muted w-32"
          step={config.showSeconds ? 1 : 60}
        />
      </div>
    </div>
  );
} 