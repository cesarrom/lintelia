'use client';

import { SeparatorHorizontal } from 'lucide-react';
import { ToolbarProps } from '../../types';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';

export function PageSeparatorToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'page-separator',
    data: {
      type: 'page-separator',
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
      <SeparatorHorizontal className="h-4 w-4" />
      <span>Page Separator</span>
    </Button>
  );
} 