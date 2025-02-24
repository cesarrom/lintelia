'use client';

import { Radio as RadioIcon } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export function RadioCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const selectedValue = field.defaultValue as string;
  const options = field.options || [];

  return (
    <FieldWrapper
      field={field}
      icon={RadioIcon}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <RadioGroup
          value={selectedValue}
          className="pointer-events-none"
        >
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} disabled />
              <Label className="text-sm text-muted-foreground">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </FieldWrapper>
  );
} 