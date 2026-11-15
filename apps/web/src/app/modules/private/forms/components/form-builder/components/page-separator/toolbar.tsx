'use client';

import { useDraggable } from '@dnd-kit/core';
import { SeparatorHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../schemas';
import { v4 as uuid } from 'uuid';
import { pageSeparatorConfigSchema } from '@repo/fintivio/schemas';

export function PageSeparatorToolbar({ disabled }: ToolbarProps) {
  const id = `toolbar-page-separator-${uuid()}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      type: 'pageSeparator',
      config: pageSeparatorConfigSchema.parse({
        type: 'pageSeparator',
        propertyName: `page${uuid().substring(0, 8)}`,
        title: 'New Page',
        description: '',
        required: false,
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className="flex w-full cursor-grab items-center justify-start gap-2"
      disabled={disabled || isDragging}
      {...listeners}
      {...attributes}
    >
      <SeparatorHorizontal className="h-4 w-4" />
      <span>Page Separator</span>
    </Button>
  );
} 