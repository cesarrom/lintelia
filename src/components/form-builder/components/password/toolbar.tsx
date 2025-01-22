'use client';

import { KeyRound } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

interface PasswordConfig {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  showStrengthMeter?: boolean;
  showToggleVisibility?: boolean;
}

const defaultConfig: PasswordConfig = {
  minLength: 8,
  maxLength: 32,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  showStrengthMeter: true,
  showToggleVisibility: true,
};

export function PasswordToolbar() {
  return (
    <ToolbarButton
      type="password"
      label="Password"
      icon={KeyRound}
      defaultConfig={defaultConfig}
    />
  );
} 