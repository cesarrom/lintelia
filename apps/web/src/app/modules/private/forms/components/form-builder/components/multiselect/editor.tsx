'use client';

import { ListFilter } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { Badge } from '@/components/ui/badge';
import { MultiselectConfig } from '@repo/lintelia/schemas';

export function MultiselectEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<MultiselectConfig>) {
  // Get options based on source type
  const options = config.source.type === 'static' 
    ? config.source.options 
    : [];

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <ListFilter className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.length > 0 ? (
          options.map((option) => (
            <Badge key={option.value} variant="secondary">
              {option.label}
            </Badge>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">
            {config.placeholder || 'Select options...'}
          </div>
        )}
      </div>
    </div>
  );
} 