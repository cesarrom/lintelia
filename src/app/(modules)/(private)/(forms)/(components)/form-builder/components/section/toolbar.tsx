'use client';

import { LayoutPanelTop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../types';
import { useDraggable } from '@dnd-kit/core';

export function SectionToolbar({
  onDragStart,
  onDragEnd,
}: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'section',
    data: {
      type: 'section',
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="ghost"
      className="w-full justify-start gap-2"
      {...attributes}
      {...listeners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <LayoutPanelTop className="h-4 w-4" />
      Section
    </Button>
  );
} 