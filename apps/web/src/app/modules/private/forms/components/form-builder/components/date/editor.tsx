'use client';

import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { DateConfig } from '@repo/fintivio/schemas';

export function DateEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<DateConfig>) {
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
        type="date"
        value={config.defaultValue || ''}
        disabled
        className="pointer-events-none bg-muted"
      />
    </div>
  );
} 