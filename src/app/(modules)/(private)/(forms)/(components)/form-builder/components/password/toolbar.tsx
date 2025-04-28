'use client';

import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';
import { ToolbarProps } from '../../schemas';
import { passwordConfigSchema } from './schema';
import { v4 as uuid } from 'uuid';

export function PasswordToolbar({ disabled }: ToolbarProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'password-toolbar',
    data: {
      type: 'password',
      config: passwordConfigSchema.parse({
        type: 'password',
        propertyName: `passwordField${uuid().substring(0, 4)}`,
        label: 'Password',
        placeholder: 'Enter your password',
        required: false,
        showToggle: true,
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
      <KeyRound className="mr-2 h-4 w-4" />
      <span className="text-sm">Password</span>
    </Button>
  );
} 