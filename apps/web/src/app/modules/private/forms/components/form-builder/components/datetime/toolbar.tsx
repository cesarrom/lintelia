'use client';

import { Calendar } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { ToolbarProps } from '../../schemas';
import { datetimeConfigSchema } from '@repo/fintivio/schemas';

export function DatetimeToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'datetime',
    data: {
      type: 'datetime',
      config: datetimeConfigSchema.parse({
        type: 'datetime',
        propertyName: 'dateField',
        label: 'Date & Time',
        format: 'datetime',
        required: false,
      }),
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground',
        isDragging && 'ring-2 ring-primary',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <Calendar className="h-4 w-4" />
      <span className="text-sm">Date & Time</span>
    </div>
  );
} 