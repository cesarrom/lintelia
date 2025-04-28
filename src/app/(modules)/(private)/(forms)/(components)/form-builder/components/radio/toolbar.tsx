'use client';

import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Radio } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { v4 as uuid } from 'uuid';
import { radioConfigSchema } from './schema';

export function RadioToolbar({ disabled }: ToolbarProps) {
  const id = `radio-${uuid()}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: {
      type: 'radio',
      config: radioConfigSchema.parse({
        type: 'radio',
        propertyName: `radioField${uuid().slice(0, 8)}`,
        label: 'Radio Group',
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
      }),
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className="justify-start w-full"
      disabled={disabled || isDragging}
      {...attributes}
      {...listeners}
    >
      <Radio className="mr-2 h-4 w-4" />
      Radio Group
    </Button>
  );
} 