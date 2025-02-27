'use client';

import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { DatetimeConfig } from './schema';
import { EditorProps } from '../../schemas';

export function DatetimeEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<DatetimeConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Calendar className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <Input
        type={config.format === 'time' ? 'time' : 'datetime-local'}
        disabled
        className="pointer-events-none bg-muted"
        placeholder={config.placeholder}
      />
    </div>
  );
} 