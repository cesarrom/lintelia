'use client';

import { CalendarDays } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { dateConfigSchema } from './schema';

export function DateToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'date',
    data: {
      type: 'date',
      config: dateConfigSchema.parse({
        propertyName: 'date',
        label: 'Date Field',
        placeholder: '',
        description: '',
        required: false,
        defaultValue: undefined,
        validation: {
          minDate: undefined,
          maxDate: undefined,
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
      <CalendarDays className="h-4 w-4" />
      <span>Date</span>
    </Button>
  );
} 