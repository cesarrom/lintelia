'use client';

import { Star } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { v4 as uuid } from 'uuid';
import { ratingConfigSchema } from '@repo/lintelia/schemas';

export function RatingToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'rating-toolbar',
    data: {
      type: 'rating',
      config: ratingConfigSchema.parse({
        type: 'rating',
        propertyName: `rating${uuid().substring(0, 8)}`,
        label: 'Rating',
        required: false,
        maxRating: 5,
        showLabels: false,
        lowLabel: 'Poor',
        highLabel: 'Excellent',
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="ghost"
      className="w-full justify-start gap-2"
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <Star className="h-4 w-4" />
      <span>Rating</span>
    </Button>
  );
} 