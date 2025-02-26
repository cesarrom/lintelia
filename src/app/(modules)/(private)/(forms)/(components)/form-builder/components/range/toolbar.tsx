'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { ToolbarProps } from '../../types';

export function RangeToolbar({
  onDragStart,
  onDragEnd,
}: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'range',
    data: {
      type: 'range',
      config: {
        label: 'Range',
        description: '',
        required: false,
        min: 0,
        max: 100,
        step: 1,
        showValue: true,
        valuePrefix: '',
        valueSuffix: '',
      },
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className="w-full justify-start gap-2"
      {...attributes}
      {...listeners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-dragging={isDragging}
    >
      <SlidersHorizontal className="h-4 w-4" />
      Range
    </Button>
  );
} 