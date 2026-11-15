'use client';

import { FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { FileConfig } from '@repo/fintivio/schemas';

export function FileEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<FileConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        {config.multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse'}
      </div>
    </div>
  );
} 