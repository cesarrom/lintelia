'use client';

import { FileUp } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function FileCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config || {};
  const accept = config.accept || '*';
  const multiple = config.multiple || false;

  return (
    <FieldWrapper
      field={field}
      icon={FileUp}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-2">
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            'pointer-events-none',
            'text-muted-foreground'
          )}
        >
          <FileUp className="mr-2 h-4 w-4" />
          {field.placeholder || (multiple ? 'Choose files' : 'Choose file')}
          <span className="ml-auto text-xs text-muted-foreground">
            {accept}
          </span>
        </Button>
      </div>
    </FieldWrapper>
  );
} 