'use client';

import { useDraggable } from '@dnd-kit/core';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { emailConfigSchema } from '@repo/fintivio/schemas';

export function EmailToolbar() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'email',
    data: {
      type: 'email',
      config: emailConfigSchema.parse({
        type: 'email',
        propertyName: 'email',
        label: 'Email',
        placeholder: 'Enter email address',
        required: false,
      }),
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-card p-4 hover:bg-accent',
        isDragging && 'ring-2 ring-primary'
      )}
    >
      <Mail className="h-4 w-4" />
      <div className="text-sm">Email</div>
    </div>
  );
} 