'use client';

import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { timeConfigSchema } from './schema';

export function TimeToolbar() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'time',
    data: {
      type: 'time',
      config: timeConfigSchema.parse({
        type: 'time',
        propertyName: 'time',
        label: 'Time',
        placeholder: 'Select time',
        description: '',
        required: false,
        min: '',
        max: '',
        step: 60,
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={cn('w-full justify-start gap-2', isDragging && 'ring-2 ring-primary')}
      {...attributes}
      {...listeners}
    >
      <Clock className="h-4 w-4" />
      Time
    </Button>
  );
} 