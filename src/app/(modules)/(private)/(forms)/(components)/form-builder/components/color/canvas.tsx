'use client';

import { Palette } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ColorCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const color = field.defaultValue as string || '#000000';

  return (
    <FieldWrapper
      field={field}
      icon={Palette}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'pointer-events-none'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full border"
              style={{ backgroundColor: color }}
            />
            <span>{color}</span>
          </div>
        </Button>
      </div>
    </FieldWrapper>
  );
} 