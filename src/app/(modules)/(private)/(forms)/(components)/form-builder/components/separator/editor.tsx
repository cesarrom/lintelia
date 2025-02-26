'use client';

import { SeparatorHorizontal } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { separatorConfigSchema } from './schema';

export function SeparatorEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof separatorConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <SeparatorHorizontal className="h-4 w-4" />
      </div>
      {config.showLabel && config.label && (
        <div className="mb-2 pl-6">
          <Label>{config.label}</Label>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
      )}
      <Separator className="my-2" />
    </div>
  );
} 