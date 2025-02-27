'use client';

import { SeparatorHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { PageSeparatorConfig } from './schema';

export function PageSeparatorEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<PageSeparatorConfig>) {
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
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <div className="w-full border-t border-dashed border-primary/50 my-2" />
        <h3 className="text-lg font-semibold mt-2">{config.title}</h3>
        {config.description && (
          <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
        )}
        <div className="text-xs text-muted-foreground mt-2">Page Break</div>
      </div>
    </div>
  );
} 