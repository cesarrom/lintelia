'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { emailConfigSchema, emailInputSchema, emailOutputSchema } from './schema';

export function EmailViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof emailConfigSchema, typeof emailInputSchema, typeof emailOutputSchema>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <Input
        id={id}
        type="email"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
        placeholder={config.placeholder}
        className={error ? 'border-destructive' : undefined}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 