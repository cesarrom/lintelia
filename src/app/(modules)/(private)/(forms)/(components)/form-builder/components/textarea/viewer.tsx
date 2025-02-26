'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../types';
import { textareaConfigSchema, textareaInputSchema, textareaOutputSchema } from './schema';

export function TextareaViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof textareaConfigSchema, typeof textareaInputSchema, typeof textareaOutputSchema>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <Textarea
        id={id}
        rows={config.rows}
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        className={cn(
          error && 'border-destructive',
          !config.resizable && 'resize-none'
        )}
        minLength={config.minLength}
        maxLength={config.maxLength}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 