'use client';

import { ListChecks } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function MultiselectCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const selectedValues = (field.defaultValue as string[]) || [];
  const selectedOptions = field.options?.filter(opt => selectedValues.includes(opt.value)) || [];

  return (
    <FieldWrapper
      field={field}
      icon={ListChecks}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <div className={cn(
          'flex flex-wrap gap-1 min-h-[2.5rem] rounded-md border bg-muted px-3 py-2',
          'pointer-events-none'
        )}>
          {selectedOptions.length > 0 ? (
            selectedOptions.map(option => (
              <Badge key={option.value} variant="secondary">
                {option.label}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {field.placeholder || 'Select options...'}
            </span>
          )}
        </div>
      </div>
    </FieldWrapper>
  );
} 