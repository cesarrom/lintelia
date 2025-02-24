'use client';

import { LayoutGrid } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { cn } from '@/lib/utils';

export function SectionCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const columns = field.config?.columns || 1;

  return (
    <FieldWrapper
      field={field}
      icon={LayoutGrid}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <div className={cn(
          'grid gap-4 rounded-lg border bg-muted/50 p-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-2',
          columns === 3 && 'grid-cols-3',
          columns === 4 && 'grid-cols-4'
        )}>
          {Array.from({ length: columns }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg border border-dashed border-muted-foreground/25 bg-muted/25"
            />
          ))}
        </div>
      </div>
    </FieldWrapper>
  );
} 