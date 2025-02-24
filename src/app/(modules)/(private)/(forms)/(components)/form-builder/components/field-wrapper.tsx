'use client';

import { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormComponentProps } from '../types';

interface FieldWrapperProps extends FormComponentProps {
  icon: LucideIcon | React.FC<LucideProps>;
  children?: React.ReactNode;
}

export function FieldWrapper({ field, icon: Icon, onSelect, isSelected, children }: FieldWrapperProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-card shadow-sm',
        isSelected && 'ring-2 ring-primary',
        'cursor-pointer hover:bg-accent/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span className="font-medium">{field.label}</span>
      </div>
      {field.description && (
        <p className="mt-1 text-sm text-muted-foreground">{field.description}</p>
      )}
      {children}
    </div>
  );
} 