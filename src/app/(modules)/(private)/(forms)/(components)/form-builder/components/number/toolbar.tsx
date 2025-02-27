'use client';

import { Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDraggable } from '@dnd-kit/core';
import { ToolbarProps } from '../../schemas';
import { numberConfigSchema } from './schema';
import { v4 as uuid } from 'uuid';

export function NumberToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'number-toolbar',
    data: {
      type: 'number',
      config: numberConfigSchema.parse({
        propertyName: `number${uuid().substring(0, 8)}`,
        label: 'Number Field',
        description: '',
        required: false,
        placeholder: 'Enter a number',
        defaultValue: undefined,
        validation: {
          min: undefined,
          max: undefined,
          step: undefined,
          precision: undefined
        }
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
      <Hash className="h-4 w-4" />
      <span>Number</span>
    </Button>
  );
}