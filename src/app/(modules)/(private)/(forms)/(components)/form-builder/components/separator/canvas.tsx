'use client';

import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { cn } from '@/lib/utils';

interface SeparatorConfig {
  showLabel: boolean;
  labelPosition: 'left' | 'center' | 'right';
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
}

export function SeparatorCanvas({ field }: FormComponentProps) {
  const config = (field.config || {
    showLabel: true,
    labelPosition: 'center',
    thickness: 1,
    style: 'solid'
  }) as SeparatorConfig;

  const borderStyle = {
    borderTopWidth: `${config.thickness}px`,
    borderTopStyle: config.style
  };

  return (
    <FieldWrapper field={field}>
      <div className="py-4">
        {config.showLabel ? (
          <div
            className={cn('flex items-center gap-4', {
              'justify-start': config.labelPosition === 'left',
              'justify-center': config.labelPosition === 'center',
              'justify-end': config.labelPosition === 'right'
            })}
          >
            {config.labelPosition === 'left' && (
              <span className="text-sm font-medium">{field.label}</span>
            )}
            <div className="flex-1" style={borderStyle} />
            {config.labelPosition === 'center' && (
              <span className="text-sm font-medium whitespace-nowrap px-4">
                {field.label}
              </span>
            )}
            {config.labelPosition === 'center' && <div className="flex-1" style={borderStyle} />}
            {config.labelPosition === 'right' && (
              <span className="text-sm font-medium">{field.label}</span>
            )}
          </div>
        ) : (
          <div style={borderStyle} />
        )}
      </div>
    </FieldWrapper>
  );
} 