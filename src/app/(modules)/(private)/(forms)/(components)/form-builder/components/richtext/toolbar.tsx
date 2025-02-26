'use client';

import { AlignLeft } from 'lucide-react';
import { ToolbarProps } from '../../types';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';

export function RichtextToolbar({
  onDragStart,
  onDragEnd,
  disabled,
}: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'richtext',
    data: {
      type: 'richtext',
    },
  });
  return (
    <Button
      ref={setNodeRef}
      variant="ghost"
      size="sm"
      className="w-full justify-start"
      {...attributes}
      {...listeners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      disabled={disabled}
      draggable
    >
      <AlignLeft className="mr-2 h-4 w-4" />
      <span>Rich Text</span>
    </Button>
  );
} 