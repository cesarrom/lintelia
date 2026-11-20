'use client';

import { Type } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { TextConfig } from '@repo/lintelia/schemas';

export function TextEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<TextConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Type className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <Input
        type="text"
        placeholder={config.placeholder}
        disabled
        className="pointer-events-none bg-muted"
      />
    </div>
  );
} 