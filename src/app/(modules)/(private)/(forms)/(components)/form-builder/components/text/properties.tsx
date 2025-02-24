'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function TextProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const getValidationValue = (type: 'minLength' | 'maxLength' | 'pattern') => {
    const value = field.validation?.find(v => v.type === type)?.value;
    return value !== undefined ? String(value) : '';
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Text-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Min Length</Label>
          <Input
            type="number"
            value={getValidationValue('minLength')}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const validation = field.validation || [];
              const index = validation.findIndex(v => v.type === 'minLength');

              if (value > 0) {
                const rule = {
                  type: 'minLength' as const,
                  value: value as number,
                  message: `Minimum length is ${value} characters`,
                };

                if (index >= 0) {
                  validation[index] = rule;
                } else {
                  validation.push(rule);
                }
              } else if (index >= 0) {
                validation.splice(index, 1);
              }

              onChange({ ...field, validation });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Max Length</Label>
          <Input
            type="number"
            value={getValidationValue('maxLength')}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const validation = field.validation || [];
              const index = validation.findIndex(v => v.type === 'maxLength');

              if (value > 0) {
                const rule = {
                  type: 'maxLength' as const,
                  value: value as number,
                  message: `Maximum length is ${value} characters`,
                };

                if (index >= 0) {
                  validation[index] = rule;
                } else {
                  validation.push(rule);
                }
              } else if (index >= 0) {
                validation.splice(index, 1);
              }

              onChange({ ...field, validation });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Pattern</Label>
          <Input
            value={getValidationValue('pattern')}
            onChange={(e) => {
              const value = e.target.value;
              const validation = field.validation || [];
              const index = validation.findIndex(v => v.type === 'pattern');

              if (value) {
                const rule = {
                  type: 'pattern' as const,
                  value: value as string,
                  message: 'Invalid format',
                };

                if (index >= 0) {
                  validation[index] = rule;
                } else {
                  validation.push(rule);
                }
              } else if (index >= 0) {
                validation.splice(index, 1);
              }

              onChange({ ...field, validation });
            }}
          />
        </div>
      </div>
    </div>
  );
} 