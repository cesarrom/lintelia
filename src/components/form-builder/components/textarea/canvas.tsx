'use client';

import { AlignLeft } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Textarea } from '@/components/ui/textarea';

export function TextareaCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  return (
    <FieldWrapper
      field={field}
      icon={AlignLeft}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Textarea
          placeholder={field.placeholder || 'Enter text here...'}
          disabled
          className="pointer-events-none bg-muted resize-none"
        />
      </div>
    </FieldWrapper>
  );
} 