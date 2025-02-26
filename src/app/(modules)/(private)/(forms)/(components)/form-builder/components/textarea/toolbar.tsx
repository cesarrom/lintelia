'use client';

import { AlignLeft } from 'lucide-react';
import { ToolbarProps } from '../../types';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';

export function TextareaToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'textarea',
    data: {
      type: 'textarea',
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
      <AlignLeft className="h-4 w-4" />
      <span>Text Area</span>
    </Button>
  );
} 