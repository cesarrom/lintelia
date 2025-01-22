'use client';

import { Clock } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function TimeCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const time = field.defaultValue as string;

  return (
    <FieldWrapper
      field={field}
      icon={Clock}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'pointer-events-none',
            !time && 'text-muted-foreground'
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {time || field.placeholder || 'Select time'}
        </Button>
      </div>
    </FieldWrapper>
  );
} 