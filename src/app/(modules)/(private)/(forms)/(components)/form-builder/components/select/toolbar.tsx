'use client';

import { useDraggable } from '@dnd-kit/core';
import { ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../schemas';

export function SelectToolbar({ onDragStart, onDragEnd, disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'select-toolbar',
    data: {
      type: 'select',
      config: {
        propertyName: 'select',
        label: 'Select',
        placeholder: 'Select an option',
        description: '',
        required: false,
        source: {
          type: 'static',
          options: [
            { id: '1', label: 'Option 1', value: 'option1' },
            { id: '2', label: 'Option 2', value: 'option2' },
            { id: '3', label: 'Option 3', value: 'option3' },
          ],
        },
      },
    },
  });

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      className="justify-start w-full"
      {...attributes}
      {...listeners}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart?.({
          active: { id: 'select-toolbar', data: { current: { type: 'select' } } },
        } as any);
      }}
      onDragEnd={() => onDragEnd?.({} as any)}
      disabled={disabled || isDragging}
    >
      <ListFilter className="mr-2 h-4 w-4" />
      Select
    </Button>
  );
} 