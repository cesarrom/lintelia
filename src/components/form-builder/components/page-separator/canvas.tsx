'use client';

import { LucideProps, SplitSquareHorizontalIcon } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageSeparatorConfig {
  title: string;
  description?: string;
  showBackButton: boolean;
  showNextButton: boolean;
  backButtonText: string;
  nextButtonText: string;
}

const defaultConfig: PageSeparatorConfig = {
  title: 'Page 2',
  description: 'Continue to the next page',
  showBackButton: true,
  showNextButton: true,
  backButtonText: 'Previous',
  nextButtonText: 'Next'
};

export function PageSeparatorCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config ? { ...defaultConfig, ...field.config as Partial<PageSeparatorConfig> } : defaultConfig;

  return (
    <FieldWrapper
      field={field}
      icon={(props: LucideProps) => <SplitSquareHorizontalIcon {...props} />}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <h3 className="text-lg font-semibold">{config.title}</h3>
          <div className="h-px flex-1 bg-border" />
        </div>

        {config.description && (
          <p className="text-sm text-muted-foreground text-center">{config.description}</p>
        )}

        <div className="flex items-center justify-between gap-4 mt-4">
          {config.showBackButton && (
            <Button variant="outline" size="sm" className="w-24">
              {config.backButtonText}
            </Button>
          )}
          {config.showNextButton && (
            <Button size="sm" className={cn("w-24", !config.showBackButton && "ml-auto")}>
              {config.nextButtonText}
            </Button>
          )}
        </div>
      </div>
    </FieldWrapper>
  );
} 