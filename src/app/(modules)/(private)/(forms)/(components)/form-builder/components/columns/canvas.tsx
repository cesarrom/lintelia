'use client';

import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';

interface ColumnConfig {
  count: number;
  widths: string[];
  gap: number;
}

export function ColumnsCanvas({ field, children }: FormComponentProps) {
  const config = (field.config || {
    count: 2,
    widths: ['1fr', '1fr'],
    gap: 4
  }) as ColumnConfig;

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: config.widths.join(' '),
    gap: `${config.gap * 0.25}rem`
  };

  return (
    <FieldWrapper field={field}>
      <div style={gridStyle}>
        {children}
      </div>
    </FieldWrapper>
  );
} 