'use client';

import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { RatingConfig } from './schema';

export function RatingEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<RatingConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Star className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {Array.from({ length: config.maxRating }).map((_, i) => (
          <Star
            key={i}
            className="h-5 w-5 text-muted-foreground"
          />
        ))}
        {config.showLabels && (
          <div className="ml-2 text-sm text-muted-foreground">
            {config.lowLabel} - {config.highLabel}
          </div>
        )}
      </div>
    </div>
  );
} 