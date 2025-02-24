'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

export function SectionProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const columns = field.config?.columns || 1;

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Section-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Columns</Label>
          <RadioGroup
            value={columns.toString()}
            onValueChange={(value) => onChange({
              ...field,
              config: { ...field.config, columns: parseInt(value, 10) }
            })}
            className="grid grid-cols-4 gap-4"
          >
            {[1, 2, 3, 4].map((cols) => (
              <div key={cols}>
                <RadioGroupItem
                  value={cols.toString()}
                  id={`cols-${cols}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`cols-${cols}`}
                  className={cn(
                    'flex aspect-video items-center justify-center rounded-lg border-2 border-muted bg-popover p-2',
                    'hover:bg-accent hover:text-accent-foreground',
                    'peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary'
                  )}
                >
                  <div className={cn(
                    'grid h-full w-full gap-2',
                    cols === 1 && 'grid-cols-1',
                    cols === 2 && 'grid-cols-2',
                    cols === 3 && 'grid-cols-3',
                    cols === 4 && 'grid-cols-4'
                  )}>
                    {Array.from({ length: cols }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-sm bg-muted"
                      />
                    ))}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
} 