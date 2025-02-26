'use client';

import { FileUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { fileConfigSchema } from './schema';

export function FileEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof fileConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <FileUp className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div
        className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed bg-muted p-4 text-sm text-muted-foreground"
      >
        <div className="text-center">
          <FileUp className="mx-auto h-8 w-8 mb-2" />
          <p>{config.placeholder}</p>
          <p className="text-xs">
            {config.allowMultiple ? 'Multiple files allowed' : 'Single file only'}
          </p>
        </div>
      </div>
    </div>
  );
} 