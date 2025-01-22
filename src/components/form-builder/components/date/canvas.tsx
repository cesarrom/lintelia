'use client';

import { Calendar as CalendarIcon } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function DateCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const date = field.defaultValue ? new Date(field.defaultValue as string) : undefined;

  return (
    <FieldWrapper
      field={field}
      icon={CalendarIcon}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'pointer-events-none',
            !date && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : field.placeholder || 'Pick a date'}
        </Button>
      </div>
    </FieldWrapper>
  );
} 