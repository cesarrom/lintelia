'use client';

import { Radio } from 'lucide-react';
import { ToolbarProps } from '../../types';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';

export function RadioToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'radio',
    data: {
      type: 'radio',
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
      <Radio className="h-4 w-4" />
      <span>Radio</span>
    </Button>
  );
} 