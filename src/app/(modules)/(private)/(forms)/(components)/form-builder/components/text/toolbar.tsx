'use client';

import { Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { ToolbarProps } from '../../schemas';
import { textConfigSchema } from './schema';

export function TextToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'text',
    data: {
      type: 'text',
      config: textConfigSchema.parse({
        propertyName: 'text',
        label: 'Text Field',
        placeholder: '',
        description: '',
        required: false,
        validation: {
          minLength: undefined,
          maxLength: undefined,
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
      <Type className="h-4 w-4" />
      <span>Text</span>
    </Button>
  );
} 