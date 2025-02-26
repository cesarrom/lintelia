'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { passwordConfigSchema, passwordInputSchema, passwordOutputSchema } from './schema';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function calculatePasswordStrength(password: string, config: any): number {
  if (!password) return 0;

  let score = 0;
  const maxScore = 100;

  // Length check
  if (password.length >= config.minLength) {
    score += 25;
  }

  // Numbers check
  if (config.requireNumbers && /\d/.test(password)) {
    score += 25;
  }

  // Letters check
  if (config.requireLetters && /[a-zA-Z]/.test(password)) {
    score += 25;
  }

  // Symbols check
  if (config.requireSymbols && /[^a-zA-Z0-9]/.test(password)) {
    score += 25;
  }

  return Math.min(score, maxScore);
}

function getStrengthColor(strength: number): string {
  if (strength < 25) return 'bg-destructive';
  if (strength < 50) return 'bg-orange-500';
  if (strength < 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function PasswordViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<typeof passwordConfigSchema, typeof passwordInputSchema, typeof passwordOutputSchema>) {
  const [showPassword, setShowPassword] = useState(false);
  const strength = calculatePasswordStrength(value as string || '', config);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={cn(error ? 'border-destructive' : undefined, 'pr-10')}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
      {config.showStrengthIndicator && value && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full transition-all', getStrengthColor(strength))}
              style={{ width: `${strength}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Password strength: {strength < 25 ? 'Weak' : strength < 50 ? 'Fair' : strength < 75 ? 'Good' : 'Strong'}
          </p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 