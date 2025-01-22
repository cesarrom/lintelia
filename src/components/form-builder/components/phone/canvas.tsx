'use client';

import { Phone } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PhoneConfig {
  format: string;
  placeholder: string;
  countryCode: string;
  showCountryCode: boolean;
}

const defaultConfig: PhoneConfig = {
  format: '(###) ###-####',
  placeholder: 'Enter phone number',
  countryCode: '+1',
  showCountryCode: true
};

export function PhoneCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config ? { ...defaultConfig, ...field.config as Partial<PhoneConfig> } : defaultConfig;

  return (
    <FieldWrapper
      field={field}
      icon={Phone}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="flex gap-2">
        {config.showCountryCode && (
          <Input
            type="text"
            value={config.countryCode}
            readOnly
            className="w-16 text-center bg-muted"
          />
        )}
        <Input
          type="tel"
          placeholder={config.placeholder}
          value={field.defaultValue || ''}
          readOnly
          className={cn(config.showCountryCode ? 'flex-1' : 'w-full')}
        />
      </div>
    </FieldWrapper>
  );
} 