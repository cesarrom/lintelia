'use client';

import { Link } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { v4 as uuid } from 'uuid';
import { urlConfigSchema } from '@repo/fintivio/schemas';

export function UrlToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'url-toolbar',
    data: {
      type: 'url',
      config: urlConfigSchema.parse({
        type: 'url',
        propertyName: `urlField${uuid().substring(0, 4)}`,
        label: 'URL',
        required: false,
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="ghost"
      className="w-full justify-start gap-2"
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <Link className="h-4 w-4" />
      <span>URL</span>
    </Button>
  );
} 