'use client';

import { KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EditorProps } from '../../schemas';
import { PasswordConfig } from '@repo/fintivio/schemas';

export function PasswordEditor({
  id,
  config,
  isSelected,
  onSelect,
}: EditorProps<PasswordConfig>) {
  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <KeyRound className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <Input
        type="password"
        disabled
        placeholder={config.placeholder || 'Password'}
        className="pointer-events-none bg-muted"
      />
      {config.showStrengthIndicator && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 bg-destructive" />
        </div>
      )}
    </div>
  );
} 