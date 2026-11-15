'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { NumberConfig } from '@repo/fintivio/schemas';

export function NumberEditor({ id, config, isSelected, onSelect }: EditorProps<NumberConfig>) {
  return (
    <div 
      className={cn(
        "flex flex-col gap-2 p-4 border rounded-md cursor-pointer",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onSelect?.()}
    >
      {config.label && (
        <label className="text-sm font-medium">
          {config.label}
          {config.required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {config.description && (
        <p className="text-xs text-muted-foreground">{config.description}</p>
      )}
      <Input
        type="number"
        placeholder={config.placeholder}
        defaultValue={config.defaultValue}
        min={config.validation?.min}
        max={config.validation?.max}
        step={config.validation?.step}
        disabled
      />
    </div>
  );
} 