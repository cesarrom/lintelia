'use client';

import { Type } from 'lucide-react';
import { ToolbarProps } from '../../types';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';

export function TextToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'text',
    data: {
      type: 'text',
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