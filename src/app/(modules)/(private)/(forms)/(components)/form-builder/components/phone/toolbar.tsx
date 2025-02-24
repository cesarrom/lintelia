'use client';

import { Phone } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

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

export function PhoneToolbar() {
  return (
    <ToolbarButton
      type="phone"
      label="Phone Number"
      icon={Phone}
      config={defaultConfig}
    />
  );
} 