'use client';

import { Mail } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '@/components/ui/input';

export function EmailCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  return (
    <FieldWrapper
      field={field}
      icon={Mail}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Input
          type="email"
          placeholder={field.placeholder || 'email@example.com'}
          disabled
          className="pointer-events-none bg-muted"
        />
      </div>
    </FieldWrapper>
  );
} 