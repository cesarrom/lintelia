'use client';

import { useDraggable } from '@dnd-kit/core';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ToolbarProps } from '../../schemas';
import { richtextConfigSchema } from './schema';
import { v4 as uuid } from 'uuid';

export function RichtextToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'richtext-toolbar',
    data: {
      type: 'richtext',
      config: richtextConfigSchema.parse({
        propertyName: `richtextField${uuid().substring(0, 4)}`,
        label: 'Rich Text',
        placeholder: 'Enter rich text content here...',
        required: false,
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className={cn(
        'flex h-14 w-full cursor-grab items-center justify-start gap-2 px-3',
        isDragging && 'ring-2 ring-primary',
        disabled && 'pointer-events-none opacity-50'
      )}
      {...attributes}
      {...listeners}
      disabled={disabled}
    >
      <FileText className="h-5 w-5" />
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium">Rich Text</span>
        <span className="text-xs text-muted-foreground">
          Formatted text with HTML support
        </span>
      </div>
    </Button>
  );
} 