'use client';

import { useDraggable } from '@dnd-kit/core';
import { AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../schemas';
import { textareaConfigSchema } from './schema';
import { v4 as uuid } from 'uuid';

export function TextareaToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'textarea-toolbar',
    data: {
      type: 'textarea',
      config: textareaConfigSchema.parse({
        type: 'textarea',
        propertyName: `textareaField${uuid().substring(0, 4)}`,
        label: 'Text Area',
        placeholder: 'Enter text here...',
        description: '',
        required: false,
        rows: 4,
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
      variant="outline"
      className="flex cursor-grab items-center justify-start gap-2 w-full"
      {...attributes}
      {...listeners}
      disabled={disabled || isDragging}
    >
      <AlignLeft className="h-4 w-4" />
      <span>Text Area</span>
    </Button>
  );
} 