'use client';

import { Palette } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { colorConfigSchema } from './schema';

export function ColorToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'color',
    data: {
      type: 'color',
      config: colorConfigSchema.parse({
        propertyName: 'color',
        label: 'Color Field',
        placeholder: '',
        description: '',
        required: false,
        format: 'hex',
        defaultValue: '#000000',
        validation: {
          pattern: undefined,
        },
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="ghost"
      className="w-full justify-start gap-2"
      {...attributes}
      {...listeners}
    >
      <Palette className="h-4 w-4" />
      <span>Color</span>
    </Button>
  );
} 