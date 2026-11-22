'use client';

import { useDraggable } from '@dnd-kit/core';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../schemas';
import { v4 as uuid } from 'uuid';
import { rangeConfigSchema } from '@repo/lintelia/schemas';

export function RangeToolbar({ disabled }: ToolbarProps) {
  const id = `range-${uuid()}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      type: 'range',
      config: rangeConfigSchema.parse({
        type: 'range',
        propertyName: `rangeField${Math.floor(Math.random() * 1000)}`,
        label: 'Range Slider',
        description: '',
        required: false,
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        showValue: true,
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className="flex h-14 w-full cursor-grab items-center justify-start gap-2 px-3"
      disabled={disabled || isDragging}
      {...listeners}
      {...attributes}
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span>Range Slider</span>
    </Button>
  );
} 