'use client';

import { List } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export function SelectCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  return (
    <FieldWrapper
      field={field}
      icon={List}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Select value={field.defaultValue as string} disabled>
          <SelectTrigger className="pointer-events-none bg-muted">
            <SelectValue placeholder={field.placeholder || 'Select an option'} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FieldWrapper>
  );
} 