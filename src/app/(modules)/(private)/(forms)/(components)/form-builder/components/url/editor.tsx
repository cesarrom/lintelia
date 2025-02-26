'use client';

import { Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { urlConfigSchema } from './schema';

export function UrlEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof urlConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Link className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex">
        {config.prefix && (
          <div className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
            {config.prefix}
          </div>
        )}
        <Input
          type="url"
          placeholder={config.placeholder}
          disabled
          className={cn(
            "pointer-events-none bg-muted",
            config.prefix && "rounded-l-none"
          )}
        />
      </div>
    </div>
  );
} 