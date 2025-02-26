'use client';

import { AlignLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { textareaConfigSchema } from './schema';

export function TextareaEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof textareaConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <AlignLeft className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <Textarea
        rows={config.rows}
        placeholder={config.placeholder}
        disabled
        className={cn(
          'pointer-events-none bg-muted',
          !config.resizable && 'resize-none'
        )}
      />
    </div>
  );
} 