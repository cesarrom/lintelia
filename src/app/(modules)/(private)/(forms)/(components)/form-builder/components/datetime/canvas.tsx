'use client';

import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface DateTimeConfig {
  showDate: boolean;
  showTime: boolean;
  defaultValue?: string;
  format: string;
}

export function DateTimeCanvas({ field }: FormComponentProps) {
  const config = (field.config || {
    showDate: true,
    showTime: true,
    format: 'yyyy-MM-dd HH:mm:ss'
  }) as DateTimeConfig;

  const value = field.defaultValue ? new Date(field.defaultValue as string) : new Date();

  return (
    <FieldWrapper field={field}>
      <Input
        type={config.showTime ? 'datetime-local' : 'date'}
        value={format(value, "yyyy-MM-dd'T'HH:mm")}
        readOnly
        className="w-full"
      />
    </FieldWrapper>
  );
} 