'use client';

import { SeparatorHorizontal } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { SeparatorConfig } from '@repo/fintivio/schemas';
import { EditorProps } from '../../schemas';

export function SeparatorEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<SeparatorConfig>) {
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
      <div className="mb-2 pl-6">
        {config.showTitle && config.title && (
          <p className="text-sm font-medium mb-2">{config.title}</p>
        )}
      </div>
      <Separator 
        className="my-2" 
        orientation={config.orientation}
      />
    </div>
  );
} 