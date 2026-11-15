'use client';

import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { ToolbarProps } from '../../schemas';
import { multiselectConfigSchema } from '@repo/fintivio/schemas';

export function MultiselectToolbar({ onDragStart, onDragEnd }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'multiselect',
    data: {
      type: 'multiselect',
      config: multiselectConfigSchema.parse({
        type: 'multiselect',
        propertyName: 'multiselect',
        label: 'Multi-Select Field',
        description: '',
        required: false,
        source: {
          type: 'static',
          options: [],
        },
        defaultValue: [],
        minSelect: undefined,
        maxSelect: undefined,
        searchable: false,
        creatable: false,
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
      <ListChecks className="h-4 w-4" />
      <span>Multi-Select</span>
    </Button>
  );
} 