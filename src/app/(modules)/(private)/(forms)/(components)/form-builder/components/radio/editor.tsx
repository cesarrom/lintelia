'use client';

import { Radio } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../types';
import { radioConfigSchema } from './schema';

export function RadioEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<typeof radioConfigSchema>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <Radio className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <RadioGroup
        disabled
        className={cn(
          'pointer-events-none',
          config.layout === 'horizontal' ? 'flex gap-4' : 'space-y-2'
        )}
      >
        {config.options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} />
            <Label className="text-sm">{option.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
} 