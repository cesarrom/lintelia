'use client';

import { Type } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '@/components/ui/input';

export function TextCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  return (
    <FieldWrapper
      field={field}
      icon={Type}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Input
          type="text"
          placeholder={field.placeholder}
          disabled
          className="pointer-events-none bg-muted"
        />
      </div>
    </FieldWrapper>
  );
} 