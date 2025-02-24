'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

export function PasswordCanvas({ field }: { field: { config?: Partial<PasswordConfig> } }) {
  const [showPassword, setShowPassword] = useState(false);
  const config = { ...defaultConfig, ...field.config };

  return (
    <div className="relative w-full">
      <Input
        type={showPassword ? 'text' : 'password'}
        placeholder="Enter password"
        className={cn(
          'pr-10',
          config.showToggleVisibility && 'pr-24'
        )}
      />
      {config.showToggleVisibility && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
} 