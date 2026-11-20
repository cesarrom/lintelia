'use client';

import { Phone } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { ToolbarProps } from '../../schemas';
import { v4 as uuid } from 'uuid';
import { phoneConfigSchema } from '@repo/lintelia/schemas';

export function PhoneToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: 'phone-toolbar',
    data: {
      type: 'phone',
      config: phoneConfigSchema.parse({
        type: 'phone',
        propertyName: `phoneField_${uuid().substring(0, 4)}`,
        label: 'Phone Number',
        placeholder: 'Enter your phone number',
        description: '',
        required: false,
        format: 'international',
        defaultCountry: 'US',
      }),
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