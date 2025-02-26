'use client';

import { CheckSquare } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { checkboxConfigSchema } from './schema';

export function CheckboxEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof checkboxConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <CheckSquare className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          disabled
          checked={config.defaultChecked}
          className="pointer-events-none"
        />
        <Label className="text-sm text-muted-foreground">{config.text}</Label>
      </div>
    </div>
  );
} 