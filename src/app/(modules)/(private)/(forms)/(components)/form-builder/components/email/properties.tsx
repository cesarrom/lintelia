'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function EmailProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const hasEmailValidation = field.validation?.some(v => v.type === 'pattern' && v.value === '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$');

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Email-specific properties */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Email Format Validation</Label>
          <Switch
            checked={hasEmailValidation}
            onCheckedChange={(checked) => {
              const validation = field.validation || [];
              const index = validation.findIndex(v => v.type === 'pattern');

              if (checked) {
                const rule = {
                  type: 'pattern' as const,
                  value: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$',
                  message: 'Please enter a valid email address',
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