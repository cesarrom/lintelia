'use client';

import { Mail } from 'lucide-react';
import { ToolbarProps } from '../../types';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';

export function EmailToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'email',
    data: {
      type: 'email',
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
      <Mail className="h-4 w-4" />
      <span>Email</span>
    </Button>
  );
} 