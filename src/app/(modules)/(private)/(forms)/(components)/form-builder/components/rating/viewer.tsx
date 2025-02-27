'use client';

import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { RatingConfig } from './schema';
import { cn } from '@/lib/utils';

export function RatingViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<RatingConfig, number>) {
  const rating = value as number | undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: config.maxRating }).map((_, i) => {
          const starValue = i + 1;
          const isFilled = rating !== undefined && starValue <= rating;

          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange?.(starValue);
                onBlur?.();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange?.(starValue);
                  onBlur?.();
                }
              }}
              className={cn(
                'focus-visible:ring-ring ring-offset-background rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                error ? 'text-destructive' : isFilled ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Star className="h-5 w-5" fill={isFilled ? 'currentColor' : 'none'} />
            </button>
          );
        })}
        {config.showLabels && (
          <div className="ml-2 text-sm text-muted-foreground">
            {rating ? (rating === 1 ? config.lowLabel : rating === config.maxRating ? config.highLabel : '') : ''}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 