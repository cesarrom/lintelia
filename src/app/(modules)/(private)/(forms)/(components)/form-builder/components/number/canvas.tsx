'use client';

import { Hash } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '@/components/ui/input';

export function NumberCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const value = field.defaultValue as number;
  const config = field.config || {};

  return (
    <FieldWrapper
      field={field}
      icon={Hash}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Input
          type="number"
          value={value || ''}
          min={config.min}
          max={config.max}
          step={config.step}
          placeholder={field.placeholder || 'Enter a number'}
          className="pointer-events-none"
          disabled
        />
      </div>
    </FieldWrapper>
  );
} 