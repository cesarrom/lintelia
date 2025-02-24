'use client';

import { CheckSquare } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function CheckboxCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  return (
    <FieldWrapper
      field={field}
      icon={CheckSquare}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.id}
            checked={field.defaultValue as boolean}
            disabled
            className="pointer-events-none"
          />
          <Label
            htmlFor={field.id}
            className="text-sm text-muted-foreground"
          >
            {field.placeholder || field.label}
          </Label>
        </div>
      </div>
    </FieldWrapper>
  );
} 