'use client';

import { CheckSquare } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { checkboxConfigSchema } from './schema';

export function CheckboxToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'checkbox',
    data: {
      type: 'checkbox',
      config: checkboxConfigSchema.parse({
        type: 'checkbox',
        propertyName: 'checkbox',
        label: 'Checkbox Field',
        description: '',
        text: 'Checkbox',
        required: false,
        defaultChecked: false,
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
      <CheckSquare className="h-4 w-4" />
      <span>Checkbox</span>
    </Button>
  );
} 