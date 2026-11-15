'use client';

import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { fileConfigSchema } from '@repo/fintivio/schemas';
import { ToolbarProps } from '../../schemas';

export function FileToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'file',
    data: {
      type: 'file',
      config: fileConfigSchema.parse({
        type: 'file',
        propertyName: 'file',
        label: 'File Upload',
        description: '',
        required: false,
      }),
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
      <FileUp className="h-4 w-4" />
      <span>File Upload</span>
    </Button>
  );
} 