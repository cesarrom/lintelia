'use client';

import { useDraggable } from '@dnd-kit/core';
import { SeparatorHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../schemas';
import { separatorConfigSchema } from './schema';
import { v4 as uuid } from 'uuid';

export function SeparatorToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'separator-toolbar',
    data: {
      type: 'separator',
      config: separatorConfigSchema.parse({
        type: 'separator',
        propertyName: `separator${uuid().substring(0, 4)}`,
        title: 'Separator',
        showTitle: false,
        orientation: 'horizontal',
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className="w-full justify-start"
      disabled={disabled || isDragging}
      {...attributes}
      {...listeners}
    >
      <SeparatorHorizontal className="mr-2 h-4 w-4" />
      <span>Separator</span>
    </Button>
  );
} 