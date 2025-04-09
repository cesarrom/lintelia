'use client';

import { Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { imageConfigSchema } from './schema';
import { ToolbarProps } from '../../schemas';

export function ImageToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'image',
    data: {
      type: 'image',
      config: {
        propertyName: 'image',
        label: 'Image Field',
        placeholder: '',
        description: '',
        required: false,
        defaultValue: undefined,
        validation: {
          min: undefined,
          max: undefined,
        },
      },
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
      <Image className="h-4 w-4" />
      <span>Image</span>
    </Button>
  );
} 