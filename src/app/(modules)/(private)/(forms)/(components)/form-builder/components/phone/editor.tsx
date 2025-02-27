'use client';

import { Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { PhoneConfig } from './schema';

export function PhoneEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<PhoneConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Phone className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex gap-2">
        {config.format === 'international' && (
          <Input
            type="text"
            value={`+1`}
            disabled
            className="pointer-events-none bg-muted w-16"
          />
        )}
        <Input
          type="tel"
          placeholder={config.placeholder}
          disabled
          className="pointer-events-none bg-muted flex-1"
        />
      </div>
    </div>
  );
} 