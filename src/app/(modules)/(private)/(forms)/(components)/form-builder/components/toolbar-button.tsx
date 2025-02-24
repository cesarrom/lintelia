'use client';

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormComponentToolbarProps } from '../types';

export function ToolbarButton({ type, label, icon: Icon }: FormComponentToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: type,
    data: { type },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={cn(
        "h-auto flex-col gap-2 p-4",
        isDragging && "opacity-50"
      )}
      {...listeners}
      {...attributes}
    >
      <Icon className="h-8 w-8" />
      <span className="text-xs">{label}</span>
    </Button>
  );
} 