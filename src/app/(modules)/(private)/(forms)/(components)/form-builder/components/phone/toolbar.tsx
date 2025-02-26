'use client';

import { Phone } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../types';

export function PhoneToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'phone',
    data: {
      type: 'phone',
    },
    disabled,
  });

  return (
    <Button
      ref={setNodeRef}
      variant="ghost"
      className="w-full justify-start"
      {...attributes}
      {...listeners}
      disabled={disabled}
    >
      <Phone className="mr-2 h-4 w-4" />
      Phone
    </Button>
  );
} 