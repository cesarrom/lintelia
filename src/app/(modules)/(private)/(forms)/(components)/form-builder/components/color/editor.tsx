'use client';

import { Palette } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { colorConfigSchema } from './schema';

export function ColorEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof colorConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Palette className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="color"
          value={config.defaultValue || '#000000'}
          disabled
          className="h-10 w-20 cursor-pointer bg-muted"
        />
        <Input
          type="text"
          value={config.defaultValue || '#000000'}
          disabled
          className="pointer-events-none bg-muted flex-1"
        />
      </div>
    </div>
  );
} 