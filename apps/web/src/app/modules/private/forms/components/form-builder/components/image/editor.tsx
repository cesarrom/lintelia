'use client';

import { Image } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ImageConfig } from '@repo/lintelia/schemas';
import { EditorProps } from '../../schemas';

export function ImageEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<ImageConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Image className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config?.label}</Label>
        {config?.description && (
          <p className="text-sm text-muted-foreground">{config?.description}</p>
        )}
      </div>
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-4">
        <div className="text-sm text-muted-foreground">
          Drop image here or click to upload
        </div>
      </div>
    </div>
  );
} 