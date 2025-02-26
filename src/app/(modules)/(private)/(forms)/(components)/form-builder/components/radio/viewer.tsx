'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../types';
import { radioConfigSchema, radioInputSchema, radioOutputSchema } from './schema';

export function RadioViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof radioConfigSchema, typeof radioInputSchema, typeof radioOutputSchema>) {
  return (
    <div className="space-y-2">
      <Label className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <RadioGroup
        value={value as string}
        onValueChange={onChange}
        onBlur={onBlur}
        className={cn(
          config.layout === 'horizontal' ? 'flex gap-4' : 'space-y-2'
        )}
      >
        {config.options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={`${id}-${option.value}`} />
            <Label htmlFor={`${id}-${option.value}`} className="text-sm">
              {option.label}
              {option.description && (
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 