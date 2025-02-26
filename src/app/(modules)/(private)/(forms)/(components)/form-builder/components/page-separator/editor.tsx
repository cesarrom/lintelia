'use client';

import { SeparatorHorizontal } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { pageSeparatorConfigSchema } from './schema';

export function PageSeparatorEditor({
  id,
  config,
  isSelected,
  onSelect,
  index,
}: EditorProps<typeof pageSeparatorConfigSchema>) {
  const pageNumber = index !== undefined ? Math.floor(index / 2) + 1 : 1;

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
      <div className="flex items-center gap-4 pl-6">
        <div className="flex-1">
          <div className="h-px bg-border" />
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          {config.showTitle && config.label}
          {config.showPageNumber && (
            <span className="rounded-md bg-muted px-2 py-1">Page {pageNumber}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="h-px bg-border" />
        </div>
      </div>
    </div>
  );
} 